FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV PORT=5027
EXPOSE 5027
CMD ["node", "src/server.mjs"]
