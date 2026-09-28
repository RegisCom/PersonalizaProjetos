import { Resend } from 'resend';

export async function sendEmail({
  contratoNome,
  nomeCliente,
  detalhes,
  pdfBase64,
  valorContrato,
  materiais,
  metragemAInstalar,
  municipio,
  uf,
  to,
  cc,
  bcc,
  subject,
  customMessage
}: {
  contratoNome: string;
  nomeCliente?: string;
  detalhes?: string;
  pdfBase64?: string;
  valorContrato?: number;
  materiais?: string;
  metragemAInstalar?: string;
  municipio?: string;
  uf?: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  customMessage?: string;
}) {
  console.log("[EmailService] RESEND_API_KEY:", !!process.env.RESEND_API_KEY);
  console.log("[EmailService] SMTP_FROM:", process.env.SMTP_FROM);

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.SMTP_FROM;
  if (!from) {
    throw new Error("SMTP_FROM não configurado.");
  }

  // To list
  let recipients: string[] = [];
  if (to) {
    recipients = Array.isArray(to) ? to : to.split(',').map(e => e.trim()).filter(Boolean);
  } else if (process.env.EMAIL_TO_LIST) {
    recipients = process.env.EMAIL_TO_LIST.split(',').map(e => e.trim()).filter(Boolean);
  }

  if (recipients.length === 0) {
    throw new Error("Nenhum destinatário (Para) informado para envio do e-mail.");
  }

  // CC list
  let ccRecipients: string[] = [];
  if (cc) {
    ccRecipients = Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim()).filter(Boolean);
  } else if (process.env.EMAIL_CC_LIST) {
    ccRecipients = process.env.EMAIL_CC_LIST.split(',').map(e => e.trim()).filter(Boolean);
  }

  // BCC list
  let bccRecipients: string[] = [];
  if (bcc) {
    bccRecipients = Array.isArray(bcc) ? bcc : bcc.split(',').map(e => e.trim()).filter(Boolean);
  } else if (process.env.EMAIL_BCC_LIST) {
    bccRecipients = process.env.EMAIL_BCC_LIST.split(',').map(e => e.trim()).filter(Boolean);
  }

  console.log(`[EmailService] Enviando para: ${recipients.join(', ')} | CC: ${ccRecipients.join(', ')} | BCC: ${bccRecipients.join(', ')}`);

  const emailSubject = subject && subject.trim() !== ''
    ? subject.trim()
    : `🎉 Novo Contrato Fechado: ${nomeCliente || 'Cliente'} - ${contratoNome}`;

  let materiaisHtml = 'Não informado';

  if (materiais) {
    try {
      if (typeof materiais === 'string' && materiais.startsWith('[')) {
        const itens = JSON.parse(materiais);
        if (Array.isArray(itens) && itens.length > 0) {
          const validItens = itens.filter((it: any) => it && (typeof it === 'string' ? it.trim() : it.material?.trim()));
          if (validItens.length > 0) {
            materiaisHtml = `<ul style="margin: 0; padding-left: 20px;">${validItens.map((it: any) => {
              const name = typeof it === 'string' ? it : it.material;
              const metragemRaw = typeof it === 'object' && it.metragem ? String(it.metragem).trim() : '';
              const metragemFormatted = metragemRaw 
                ? (metragemRaw.toLowerCase().includes('m2') || metragemRaw.toLowerCase().includes('m²') ? metragemRaw : `${metragemRaw} m²`)
                : '';
              return `
                <li style="margin-bottom: 6px; color: #2d3748; font-weight: 600;">
                  <span>${name}</span>${metragemFormatted ? ` &mdash; <span style="color: #4a5568; font-weight: 700;">Metragem: ${metragemFormatted}</span>` : ''}
                </li>
              `;
            }).join('')}</ul>`;
          }
        }
      } else if (typeof materiais === 'string') {
        materiaisHtml = materiais;
      }
    } catch (e) {
      materiaisHtml = String(materiais);
    }
  }

  let cidadeDisplay = 'Não informada';
  if (municipio && uf) {
    cidadeDisplay = `${municipio} / ${uf}`;
  } else if (municipio) {
    cidadeDisplay = municipio;
  } else if (uf) {
    cidadeDisplay = uf;
  }

  let metragemDisplay = 'Não informada';
  if (metragemAInstalar && metragemAInstalar.trim() !== '') {
    const rawVal = metragemAInstalar.trim();
    metragemDisplay = rawVal.toLowerCase().includes('m²') || rawVal.toLowerCase().includes('m2') ? rawVal : `${rawVal} m²`;
  }

  const customMessageHtml = customMessage && customMessage.trim() !== '' 
    ? `
      <div style="background-color: #ebf8ff; border-left: 4px solid #3182ce; padding: 16px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0 0 6px 0; font-weight: bold; color: #2b6cb0; font-size: 13px;">Mensagem / Observações:</p>
        <p style="margin: 0; color: #2d3748; white-space: pre-line; font-size: 14px;">${customMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>
      </div>
    `
    : '';

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; color: #333; line-height: 1.6;">
      <h2 style="color: #1a365d; margin-bottom: 20px;">🎉 Parabéns a todos envolvidos!</h2>
      <p>Neste momento iniciamos uma nova jornada.</p>

      ${customMessageHtml}

      <p style="font-style: italic; color: #4a5568; margin: 20px 0;">
        Cada contrato fechado será como um carro de Fórmula 1 entrando no boxe para sua parada estratégica.<br>
        A partir desse momento, nossa equipe entra em ação synchronizada, onde cada integrante desempenha seu papel com precisão e comprometimento, 
        contribuindo para alcançar a excelência, superar expectativas e garantir a satisfação do cliente.
      </p>

      <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="color: #2d3748; margin-top: 0; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Informações do Contrato</h3>
        
        <p style="margin: 8px 0;"><strong>Nome do Cliente:</strong> ${nomeCliente && nomeCliente.trim() !== '' ? nomeCliente : 'Não informado'}</p>
        <p style="margin: 8px 0;"><strong>Nome da Obra:</strong> ${contratoNome}</p>
        <p style="margin: 8px 0;"><strong>Cidade:</strong> ${cidadeDisplay}</p>
        <p style="margin: 8px 0;"><strong>Metragem do Contrato:</strong> ${metragemDisplay}</p>
        
        <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; pt: 16px;">
          <p style="margin: 16px 0 8px 0;"><strong>Itens a serem instalados:</strong></p>
          <div style="background-color: #fff; border: 1px solid #edf2f7; padding: 16px; border-radius: 8px;">${materiaisHtml}</div>
        </div>
      </div>

      <p style="margin-top: 40px; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 16px;">
        Este e-mail foi gerado pelo sistema de Gestão de Obras.
      </p>
    </div>
  `;

  try {
    const emailOptions: any = {
      from: from,
      to: recipients,
      subject: emailSubject,
      html: htmlContent,
    };

    if (ccRecipients.length > 0) {
      emailOptions.cc = ccRecipients;
    }

    if (bccRecipients.length > 0) {
      emailOptions.bcc = bccRecipients;
    }

    if (pdfBase64) {
      // Base64 looks like "data:application/pdf;base64,..."
      const base64Data = pdfBase64.includes('base64,') 
        ? pdfBase64.split('base64,')[1] 
        : pdfBase64;
        
      emailOptions.attachments = [
        {
          filename: `Contrato_${contratoNome.replace(/\s+/g, '_')}.pdf`,
          content: base64Data,
        }
      ];
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error("[EmailService] Erro Resend:", error);
      throw error;
    }

    console.log("[EmailService] Email enviado com sucesso.");
    return data;
  } catch (error) {
    console.error("[EmailService] Erro Exception:", error);
    throw error;
  }
}

export async function sendVerificationCodeEmail({
  email,
  code,
  usuarioNome
}: {
  email: string;
  code: string;
  usuarioNome: string;
}) {
  console.log("[EmailService] RESEND_API_KEY:", !!process.env.RESEND_API_KEY);
  console.log("[EmailService] SMTP_FROM:", process.env.SMTP_FROM);

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.SMTP_FROM;
  if (!from) {
    throw new Error("SMTP_FROM não configurado.");
  }

  const subject = `🔑 Seu código de verificação para alteração de senha: ${code}`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; color: #333; line-height: 1.6; border: 1px solid #edf2f7; border-radius: 12px; padding: 32px; background-color: #ffffff;">
      <h2 style="color: #1a365d; margin-top: 0; margin-bottom: 24px; text-align: center; font-size: 22px;">Alteração de Senha</h2>
      <p>Olá, <strong>${usuarioNome}</strong>!</p>
      <p>Recebemos uma solicitação para alterar a senha da sua conta no sistema <strong>Personaliza Projetos</strong>.</p>
      <p>Utilize o código de verificação abaixo para confirmar sua identidade e concluir a alteração. Este código expira em 10 minutos.</p>
      
      <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a365d;">${code}</span>
      </div>

      <p style="font-size: 13px; color: #718096; text-align: center;">Se você não solicitou essa alteração, pode ignorar este e-mail com segurança.</p>
      
      <div style="margin-top: 32px; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 16px; text-align: center;">
        Este é um e-mail automático gerado pelo sistema de Gestão de Obras. Por favor, não responda.
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: from,
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error("[EmailService] Erro Resend ao enviar código:", error);
      throw error;
    }

    console.log("[EmailService] Código enviado com sucesso para:", email);
    return data;
  } catch (error) {
    console.error("[EmailService] Exceção ao enviar código:", error);
    throw error;
  }
}
