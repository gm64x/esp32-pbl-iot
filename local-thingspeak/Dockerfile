FROM python:3-alpine
WORKDIR /app
COPY server.py .
ENV PORT=8000 DATA_FILE=/data/feeds.json RATE_LIMIT_SECONDS=0
RUN mkdir -p /data
EXPOSE 8000
CMD ["python", "-u", "server.py"]
