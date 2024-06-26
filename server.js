const express = require('express');
const cors = require('cors');
const dotenv = require("dotenv");
const { createClient } = require('redis');
const axios = require('axios');
dotenv.config();
const redisConnectionUrl = { url: process.env.PROD_REDIS_CONNECTION };
const redisClient = createClient(redisConnectionUrl);
redisClient.on('error', err => console.log(`Redis Client Error: ${err.stack ? err.stack : err}`));
redisClient.connect();

setInterval(async () => {
  const currentTime = new Date();
  const minute = currentTime.getMinutes();
  let data = await redisClient.get(`${minute}`);
  if (data) {
    try {
      let channels = JSON.parse(data).channels;
      let response = await axios({
        method: 'post',
        url: process.env.BOT_URL,
        data: { channels }
      });
      console.log("********", minute, channels, response.data);
    } catch (err) {
      console.log("********", minute, channels, err);
    }
  }
}, 60000);

const initializeServer = port => {
  try {
    const server = express();
    server.use(cors());
    server.use(express.json({ extended: false, limit: '20mb' }));
    server.post("/newChannel", async (req, res) => {
      try {
        let response = await redisClient.get(`${req.body.mint}`);
        let data;
        if (!response) {
          data = [req.body.channelId];
        } else {
          data = JSON.parse(response).channels;
          if (!data.includes(req.body.channelId)) data.push(req.body.channelId);
        }
        redisClient.set(`${req.body.mint}`, JSON.stringify({ channels: data }));
        console.log("added ", req.body.channelId, " to ", req.body.mint);
        res.status(200).send('Success');
      } catch (err) {
        console.log(err)
        res.status(500).send(err)
      }
    });
    server.get("/healthCheck", (req,res) => {
      console.log("Healthy");
      res.status(200).send("Healthy");
    });
    server.listen(port, () => console.log(`Server instance listening @port: ${port}`));
    return server;
  } catch (err) {
    console.log('Unable to initialize server:', err);
  }
};

module.exports = initializeServer(5002);