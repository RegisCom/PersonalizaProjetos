import dotenv from "dotenv";
dotenv.config();
import pg from "pg";

const { Pool } = pg;

function sanitizeDbUrl(urlStr: string): string {
  if (!urlStr) return "";
  let clean = urlStr.trim().replace(/^["']|["']$/g, "");
  if ((clean.startsWith("postgres://") || clean.startsWith("postgresql://")) && clean.includes("@")) {
    try {
      const atIdx = clean.lastIndexOf("@");
      const schemeAndAuth = clean.substring(0, atIdx);
      const hostAndRest = clean.substring(atIdx + 1);
      const schemeIdx = schemeAndAuth.indexOf("://");
      if (schemeIdx !== -1) {
        const scheme = schemeAndAuth.substring(0, schemeIdx + 3);
        const auth = schemeAndAuth.substring(schemeIdx + 3);
        if (auth.includes(":")) {
          const colonIdx = auth.indexOf(":");
          const user = auth.substring(0, colonIdx);
          const pass = auth.substring(colonIdx + 1);
          clean = `${scheme}${encodeURIComponent(decodeURIComponent(user))}:${encodeURIComponent(decodeURIComponent(pass))}@${hostAndRest}`;
        }
      }
    } catch (e) {
      // keep clean as is
    }
  }
  return clean;
}

let urlRds = process.env.DATABASE_URL || process.env.DATABASE_URL_RDS || "";
urlRds = sanitizeDbUrl(urlRds);

if (!urlRds) {
  console.error("ERRO: Nenhuma DATABASE_URL encontrada no ambiente.");
  process.exit(1);
}

let cleanUrl = urlRds.replace(/sslmode=[^&]+/g, "").replace(/\?&/g, "?").replace(/&&/g, "&");
if (cleanUrl.endsWith("?")) cleanUrl = cleanUrl.slice(0, -1);

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function main() {
  console.log("=== INICIANDO AUDITORIA DE BANCO DE DADOS E PERFORMANCE ===");
  const client = await pool.connect();

  try {
    // 1. TAMANHOS DE TODAS AS TABELAS E ÍNDICES
    console.log("\n--- 1. TAMANHOS DE TODAS AS TABELAS ---");
    const tablesSizeRes = await client.query(`
      SELECT 
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
        pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
        pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
        pg_total_relation_size(c.oid) AS total_bytes,
        pg_relation_size(c.oid) AS table_bytes,
        pg_indexes_size(c.oid) AS index_bytes
      FROM pg_class c
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC;
    `);
    console.table(tablesSizeRes.rows);

    // 2. CONTAGEM DE REGISTROS POR TABELA
    console.log("\n--- 2. CONTAGEM DE REGISTROS POR TABELA ---");
    const counts: Record<string, number> = {};
    for (const row of tablesSizeRes.rows) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
        counts[row.table_name] = parseInt(countRes.rows[0].count, 10);
      } catch (err: any) {
        counts[row.table_name] = -1;
      }
    }
    console.table(Object.entries(counts).map(([table, count]) => ({ table, count })));

    // 3. ESTRUTURA E COLUNAS DA TABELA 'obras'
    console.log("\n--- 3. ESTRUTURA E COLUNAS DA TABELA 'obras' ---");
    const obrasColsRes = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'obras'
      ORDER BY ordinal_position;
    `);
    console.table(obrasColsRes.rows);

    // 4. ESTRUTURA E COLUNAS DA TABELA 'contratos_ativos'
    console.log("\n--- 4. ESTRUTURA E COLUNAS DA TABELA 'contratos_ativos' ---");
    const caColsRes = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'contratos_ativos'
      ORDER BY ordinal_position;
    `);
    console.table(caColsRes.rows);

    // 5. ANÁLISE DE TAMANHO DE CAMPOS TEXT/JSON EM 'obras'
    console.log("\n--- 5. ANÁLISE DE TAMANHO DE CAMPOS EM 'obras' ---");
    const textColsObras = ['documentos', 'observacoes', 'observacao', 'workflowChecklist', 'workflowObservacao'];
    for (const col of textColsObras) {
      try {
        const sizeCheck = await client.query(`
          SELECT 
            COUNT(*) as total_rows,
            COUNT("${col}") as non_null_rows,
            MAX(pg_column_size("${col}")) as max_bytes,
            AVG(pg_column_size("${col}")) as avg_bytes,
            SUM(pg_column_size("${col}")) as sum_bytes
          FROM obras;
        `);
        console.log(`Coluna 'obras.${col}':`, sizeCheck.rows[0]);
      } catch (e: any) {
        console.log(`Coluna 'obras.${col}' não testada:`, e.message);
      }
    }

    // 6. ANÁLISE DE TAMANHO DE CAMPOS TEXT/JSON EM 'contratos_ativos'
    console.log("\n--- 6. ANÁLISE DE TAMANHO DE CAMPOS EM 'contratos_ativos' ---");
    const textColsCA = ['documentos', 'observacoes', 'itensInstalacao', 'itensMateriais', 'itensEquipe', 'checklist'];
    for (const col of textColsCA) {
      try {
        const sizeCheck = await client.query(`
          SELECT 
            COUNT(*) as total_rows,
            COUNT("${col}") as non_null_rows,
            MAX(pg_column_size("${col}")) as max_bytes,
            AVG(pg_column_size("${col}")) as avg_bytes,
            SUM(pg_column_size("${col}")) as sum_bytes
          FROM contratos_ativos;
        `);
        console.log(`Coluna 'contratos_ativos.${col}':`, sizeCheck.rows[0]);
      } catch (e: any) {
        console.log(`Coluna 'contratos_ativos.${col}' não testada:`, e.message);
      }
    }

    // 7. MAIORES REGISTROS DE 'obras' E 'contratos_ativos' (TOP 5)
    console.log("\n--- 7. TOP 5 MAIORES REGISTROS DE 'obras' (por pg_column_size da linha inteira) ---");
    const topObras = await client.query(`
      SELECT id, nome, "statusContrato", pg_column_size(obras.*) as row_bytes, pg_column_size(documentos) as doc_bytes
      FROM obras
      ORDER BY pg_column_size(obras.*) DESC
      LIMIT 5;
    `);
    console.table(topObras.rows);

    console.log("\n--- TOP 5 MAIORES REGISTROS DE 'contratos_ativos' ---");
    const topCA = await client.query(`
      SELECT id, "obraId", pg_column_size(contratos_ativos.*) as row_bytes, pg_column_size(documentos) as doc_bytes, pg_column_size("itens_instalacao") as inst_bytes
      FROM contratos_ativos
      ORDER BY pg_column_size(contratos_ativos.*) DESC
      LIMIT 5;
    `);
    console.table(topCA.rows);

    // 8. ÍNDICES EXISTENTES
    console.log("\n--- 8. ÍNDICES EXISTENTES EM 'obras' E 'contratos_ativos' ---");
    const indexesRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('obras', 'contratos_ativos', 'itens_orcamento', 'levantamentos', 'documentos', 'workflow_movimentacoes')
      ORDER BY tablename, indexname;
    `);
    console.table(indexesRes.rows);

    // 9. SIMULAÇÃO EXATA DO GET /api/obras (MEDINDO TEMPOS PASSO A PASSO)
    console.log("\n--- 9. MEDIÇÃO DA EXECUÇÃO COMPLETA DO 'GET /api/obras' ---");
    
    // Passo 9a: Query de Obras
    const t0 = performance.now();
    const dbObrasRes = await client.query('SELECT * FROM obras ORDER BY "createdAt" DESC');
    const t1 = performance.now();
    
    // Passo 9b: Query de Itens
    const dbItensRes = await client.query(`
      SELECT i.id, i.descricao, i.valor, i.status, i.ordem, i."obraId", i."categoriaId",
             i.subitens, i."createdAt", i."updatedAt",
             c.nome as "cat_nome", c."grupoCalculo" as "cat_grupoCalculo"
      FROM itens_orcamento i
      LEFT JOIN categorias c ON i."categoriaId" = c.id
      ORDER BY i.ordem ASC
    `);
    const t2 = performance.now();

    // Passo 9c: Processamento Node.js
    const t3 = performance.now();
    const allObras = dbObrasRes.rows;
    const allItens = dbItensRes.rows;

    const itemsByObraMap = new Map<string, any[]>();
    for (const i of allItens) {
      const oId = i.obraId;
      if (!itemsByObraMap.has(oId)) itemsByObraMap.set(oId, []);
      itemsByObraMap.get(oId)!.push({
        id: i.id,
        descricao: i.descricao,
        valor: Number(i.valor),
        status: i.status,
        observacao: i.observacao,
        ordem: Number(i.ordem),
        obraId: i.obraId,
        categoriaId: i.categoriaId,
        subitens: typeof i.subitens === 'string' ? JSON.parse(i.subitens) : (i.subitens || []),
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        categoria: {
          id: i.categoriaId,
          nome: i.cat_nome,
          grupoCalculo: i.cat_grupoCalculo
        }
      });
    }

    const freshObras = allObras.map(o => {
      let docs = typeof o.documentos === 'string' ? JSON.parse(o.documentos) : (o.documentos || []);
      return {
        ...o,
        valorContrato: Number(o.valorContrato),
        documentos: docs,
        itens: itemsByObraMap.get(o.id) || []
      };
    });
    const t4 = performance.now();

    // Passo 9d: Serialização JSON
    const t5 = performance.now();
    const jsonString = JSON.stringify(freshObras);
    const t6 = performance.now();

    const dbTimeMs = t2 - t0;
    const nodeTimeMs = t4 - t3;
    const serializeTimeMs = t6 - t5;
    const totalTimeMs = t6 - t0;
    const jsonBytes = Buffer.byteLength(jsonString, 'utf8');

    console.log("\n=======================================================");
    console.log("MÉTRICAS DO GET /api/obras (Sem filtro):");
    console.log(`- DB (Query Obras + Query Itens): ${(dbTimeMs).toFixed(2)} ms`);
    console.log(`  └─ Query Obras: ${(t1 - t0).toFixed(2)} ms (${dbObrasRes.rowCount} linhas)`);
    console.log(`  └─ Query Itens: ${(t2 - t1).toFixed(2)} ms (${dbItensRes.rowCount} linhas)`);
    console.log(`- Processamento Node.js (Mapeamento de Objetos): ${(nodeTimeMs).toFixed(2)} ms`);
    console.log(`- Serialização JSON (JSON.stringify): ${(serializeTimeMs).toFixed(2)} ms`);
    console.log(`- Tempo Total no Servidor: ${(totalTimeMs).toFixed(2)} ms`);
    console.log(`- Qtd de Objetos/Linhas Obras: ${freshObras.length}`);
    console.log(`- Qtd Total de Itens no Banco: ${allItens.length}`);
    console.log(`- Tamanho da Resposta JSON Sem Compressão: ${(jsonBytes / 1024 / 1024).toFixed(3)} MB (${jsonBytes} bytes)`);
    console.log("=======================================================\n");

    // 10. SIMULAÇÃO COM FILTRO statusContrato=CONSOLIDADO
    console.log("\n--- 10. SIMULAÇÃO DO GET /api/obras COM FILTRO statusContrato='CONSOLIDADO' ---");
    const tCons0 = performance.now();
    const dbConsRes = await client.query('SELECT * FROM obras WHERE "statusContrato" = $1 ORDER BY "createdAt" DESC', ['CONSOLIDADO']);
    const tCons1 = performance.now();
    const consObras = dbConsRes.rows.map(o => {
      let docs = typeof o.documentos === 'string' ? JSON.parse(o.documentos) : (o.documentos || []);
      return {
        ...o,
        valorContrato: Number(o.valorContrato),
        documentos: docs,
        itens: itemsByObraMap.get(o.id) || []
      };
    });
    const tCons2 = performance.now();
    const consJsonStr = JSON.stringify(consObras);
    const tCons3 = performance.now();
    const consJsonBytes = Buffer.byteLength(consJsonStr, 'utf8');

    console.log(`- Linhas retornadas para CONSOLIDADO: ${consObras.length} de ${freshObras.length}`);
    console.log(`- DB Query: ${(tCons1 - tCons0).toFixed(2)} ms`);
    console.log(`- Processamento Node: ${(tCons2 - tCons1).toFixed(2)} ms`);
    console.log(`- Serialização: ${(tCons3 - tCons2).toFixed(2)} ms`);
    console.log(`- Tamanho da Resposta (CONSOLIDADO): ${(consJsonBytes / 1024).toFixed(2)} KB (${consJsonBytes} bytes)`);

    // 11. ANÁLISE DETALHADA DAS PROPRIEDADES DO JSON DE RESULTADO
    console.log("\n--- 11. DECOMPOSIÇÃO DO TAMANHO DO PAYLOAD DA RESPOSTA ---");
    let totalDocsBytes = 0;
    let totalItensBytes = 0;
    let totalOutrosBytes = 0;

    for (const ob of freshObras) {
      const docBytes = Buffer.byteLength(JSON.stringify(ob.documentos || []), 'utf8');
      const itemBytes = Buffer.byteLength(JSON.stringify(ob.itens || []), 'utf8');
      const fullObBytes = Buffer.byteLength(JSON.stringify(ob), 'utf8');
      totalDocsBytes += docBytes;
      totalItensBytes += itemBytes;
      totalOutrosBytes += (fullObBytes - docBytes - itemBytes);
    }

    console.log(`- Total Tamanho de 'documentos' (Base64/JSON): ${(totalDocsBytes / 1024 / 1024).toFixed(3)} MB (${((totalDocsBytes/jsonBytes)*100).toFixed(1)}%)`);
    console.log(`- Total Tamanho de 'itens' (Orçamento/Subitens): ${(totalItensBytes / 1024 / 1024).toFixed(3)} MB (${((totalItensBytes/jsonBytes)*100).toFixed(1)}%)`);
    console.log(`- Total Tamanho das Outras Colunas da Obra: ${(totalOutrosBytes / 1024 / 1024).toFixed(3)} MB (${((totalOutrosBytes/jsonBytes)*100).toFixed(1)}%)`);

  } catch (err: any) {
    console.error("Erro na execução da auditoria:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
