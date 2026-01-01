module.exports = {
  apps: [
    {
      name: "ogp-api",
      script: "./dist/index.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
