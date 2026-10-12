FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV HUSKY=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_TURNSTILE_SITE_KEY
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_AUTH_SIGNUP_ENABLED=false
RUN pnpm build

FROM caddy:2-alpine AS runtime
RUN addgroup -g 1000 app && adduser -D -u 1000 -G app app \
    && setcap -r /usr/bin/caddy \
    && mkdir -p /data /config /srv \
    && chown -R app:app /data /config /srv
COPY --from=build --chown=app:app /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
USER app
EXPOSE 8080 8443
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
