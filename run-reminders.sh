#!/bin/bash
cd /root/yemey-prisha
docker exec luach-vestot node services/reminderJob.js 2>&1 | logger -t vestot-reminder
