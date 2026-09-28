module.exports = {
  apps: [
    {
      name: "PersonalizaProjetos",
      script: "dist/server.cjs",
      env_file: ".env.production",
    },
  ],
};
