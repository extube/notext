FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/build ./build

ENV NODE_ENV=production
ENV PORT=4000
ENV ORIGIN=http://localhost:4000

EXPOSE 4000

# data/ holds documents (data/<base64_id>.json) and share links; resolved
# from the working directory, so mount the volume at /app/data
VOLUME ["/app/data"]

CMD ["node", "build"]
