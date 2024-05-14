/* eslint-disable indent */
/* eslint-disable camelcase */
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const FCM = require("fcm-node");

admin.initializeApp();

const push_service = new FCM(
  "AAAArJcFDBQ:APA91bEFN5vfUHvOw7jFyiTCq9F8XUgpmV-fMnyb3aTQ76jiZGW6F3XEtIWrK07RMmaNJPw3RAz3NlX904DIlajaM8PoJ5hKd5o-0aQSV50lnX7f_0ufJMKESH1GVwwk_HDwCUaMdLqh",
);

exports.handleFallDetection = functions.https.onRequest((req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send({error: "Method Not Allowed"});
  }

  const {token, data} = req.body;

  if (!token) {
    return res.status(400).send({error: "Token not provided in request"});
  }

  const messageTitle = data && data.title ? data.title : "Fall Detected!";
  const messageBody =
    data && data.body ?
      data.body :
      "Your fall has been detected. Are you okay?";

  const message = {
    to: token,
    notification: {
      title: messageTitle,
      body: messageBody,
    },
  };

  push_service.send(message, (err, response) => {
    if (err) {
      console.error("Error sending message:", err);
      return res.status(500).send({error: "Failed to send notification"});
    } else {
      console.log("Notification sent successfully:", response);
      return res
          .status(200)
          .send({success: true, message: "Notification sent successfully"});
    }
  });
});
