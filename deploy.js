const surge = require('surge');
surge({ default: 'publish' })(['--project', './web_deploy', '--domain', 'redcarpet-app-2026.surge.sh']);
