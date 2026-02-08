export function generateDockerfile(language: string): string {
  switch (language) {
    case 'static':
      return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
`;

    case 'node':
      return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN if grep -q '"build"' package.json; then npm run build; fi
EXPOSE 3000
CMD ["npm", "start"]
`;

    case 'python':
      return `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
`;

    case 'rust':
      return `FROM rust:1.77 AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/* /usr/local/bin/
EXPOSE 8080
CMD ["app"]
`;

    default:
      return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
`;
  }
}

export function portForLanguage(language: string): number {
  switch (language) {
    case 'node': return 3000;
    case 'python': return 8000;
    case 'rust': return 8080;
    case 'static': return 80;
    default: return 80;
  }
}
