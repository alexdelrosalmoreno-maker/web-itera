# Despliegue en Easypanel

Este proyecto esta preparado para desplegarse como una web estatica servida por Nginx dentro de Docker.

## Archivos Docker

- `Dockerfile`: crea la imagen final con Nginx.
- `nginx.conf`: configura cache, compresion gzip, cabeceras basicas y `/healthz`.
- `.dockerignore`: evita copiar archivos innecesarios dentro de la imagen.
- `docker-compose.yml`: permite probar el contenedor en local.

## Probar en local

Desde la carpeta del proyecto:

```bash
docker compose up --build
```

Abre la web en:

```text
http://localhost:8080
```

Comprueba el endpoint de salud:

```text
http://localhost:8080/healthz
```

Para parar el contenedor:

```bash
docker compose down
```

## Configurar en Easypanel

1. Sube este repositorio a GitHub, GitLab o al proveedor Git que uses.
2. En Easypanel crea una nueva app.
3. Elige despliegue desde repositorio.
4. Selecciona este repositorio y la rama que quieras desplegar.
5. Tipo de build: `Dockerfile`.
6. Puerto interno de la app: `80`.
7. Dominio: apunta tu dominio a la app desde la seccion de dominios de Easypanel.
8. Activa SSL/HTTPS desde Easypanel cuando el dominio ya resuelva correctamente.

## Variables de entorno

No necesitas variables de entorno para servir la landing.

El chat usa el webhook configurado directamente en `script.js`:

```text
https://elkta.app.n8n.cloud/webhook/chat_landing_agent
```

Si cambias el webhook de n8n en el futuro, actualiza esa URL y vuelve a desplegar.

## Checklist rapido antes de publicar

- El repositorio incluye `Dockerfile`, `nginx.conf`, `.dockerignore` y `docker-compose.yml`.
- Easypanel usa puerto interno `80`.
- El dominio apunta a Easypanel.
- SSL/HTTPS esta activo.
- El endpoint `/healthz` responde `ok`.
