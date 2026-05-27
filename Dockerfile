FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src

EXPOSE 3001

CMD ["npm", "run", "server"]
