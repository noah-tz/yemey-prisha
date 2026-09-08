#!/bin/bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ "$STATUS" != "200" ]; then
  echo "$(date) - ALERT: Luach Vestot is DOWN (HTTP $STATUS)" | logger -t vestot-health
  docker compose -f /root/yemey-prisha/docker-compose.yml restart
fi
