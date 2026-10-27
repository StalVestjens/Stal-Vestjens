FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
VOLUME ["/data/uploads"]
ENV UPLOAD_DIR=/data/uploads
EXPOSE 3000
CMD ["npm", "start"]
