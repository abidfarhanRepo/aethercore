Deployment checklist - production

Pre-deploy
- [ ] Set real secrets: update POSTGRES_PASSWORD and any other secrets (JWT secret, etc.)
- [ ] Ensure DATABASE_URL and REDIS_URL point to production managed services if required
- [ ] Build and test locally: docker-compose -f docker-compose.prod.yml up --build
- [ ] Run database migrations: from backend container run npm run migrate:dev or use prisma migrate deploy
- [ ] Seed data if needed: npm run seed
- [ ] Ensure environment variables for production are set (NODE_ENV=production, PORT, JWT_SECRET)
- [ ] Configure backups for Postgres (logical or physical) and Redis persistence

Deployment steps
1. On production host, clone repo and cd infra
2. Copy docker-compose.prod.yml and any .env (do not commit secrets)
3. docker-compose -f docker-compose.prod.yml pull (optional)
4. docker-compose -f docker-compose.prod.yml up -d --build
5. Verify containers: docker-compose -f docker-compose.prod.yml ps
6. Check logs for errors: docker-compose -f docker-compose.prod.yml logs -f backend
7. Run database migrations inside backend container if not automated:
   docker-compose -f docker-compose.prod.yml exec backend sh -c "npm run migrate:dev"

Post-deploy verification
- [ ] GET /health on backend responds 200
- [ ] Frontend accessible on port 80 and loads assets
- [ ] Database has expected tables and seed data
- [ ] Check application logs for errors

Maintenance
- Monitor CPU, memory, and disk (pgdata volume)
- Rotate secrets periodically
- Regularly test backups and restore

Rollback
- If deploy fails, docker-compose -f docker-compose.prod.yml down && docker-compose -f docker-compose.prod.yml up -d <previous image tags>
- Restore database from backup if schema incompatible

Notes / TODOs
- Consider using a process manager or orchestration platform (Kubernetes) for scaling
- Add healthchecks and restart policies per service
- Use docker secrets or an external secrets manager for production secrets
- Add SSL termination (proxy/nginx/Cloudflare) in front of frontend/backend
