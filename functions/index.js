const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
// const { log } = require("firebase-functions/logger")

admin.initializeApp({ credential: admin.credential.applicationDefault() });
setGlobalOptions({ maxInstances: 10 });

// exports.handleFallDetection = functions
//   .region("asia-southeast1")
//   .https.onRequest(async (req, res) => {
//     try {
//       const message = req.body;
//       await getFirestore().collection("messages").add(message);
//       await sendFall(message);
//       res.json({
//         success: true,
//         error: null,
//       });
//     } catch (error) {
//       console.error("Error in handleFallDetection:", error);
//       res.json({
//         success: false,
//         error: error.message,
//       });
//     }
//   });

exports.handleFallDetection = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    try {
      const message = req.body;
      await sendFall(message);
      res.json({
        success: true,
        error: null,
      });
    } catch (error) {
      console.error("Error in handleFallDetection:", error);
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

/**
 * Send notification to user
 * @param {Object} body
 */
async function sendFall(body) {
  try {
    const patient = await getFirestore()
      .collection("user")
      .where("deviceID", "==", body.data.deviceID)
      .get();
    const patientEmail = patient.docs[0].data().email;
    const patientName = patient.docs[0].data().fullName;
    await getFirestore()
      .collection("fall-history")
      .add({ patientEmail: patientEmail, time: new Date(body.data.time) });
    const userDeviceSnapshot = await getFirestore()
      .collection("user-device")
      .get();
    const userList = [];
    userDeviceSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.patientEmail === patientEmail) {
        userList.push(userData.userEmail);
      }
    });
    userList.push(patientEmail);
    const userTokens = [];

    for (const userEmail of userList) {
      const userDocRef = getFirestore().collection("user").doc(userEmail);
      const userSnapshot = await userDocRef.get();
    
      if (userSnapshot.exists) {
        const userData = userSnapshot.data();
        const tokens = userData.tokens || [];
        tokens.forEach((token) => {
          if (token) {
            userTokens.push(token);
          }
        });
      }
    }

    // userTokens.forEach(async (token) => {
      const message = {
        tokens: userTokens,
        data: {
          title: "Phát hiện té ngã",
          patientEmail: patientEmail,
          patientName: patientName,
          time: body.data.time,
        },
      };
      await admin
        .messaging()
        .sendEachForMulticast(message)
        .then((response) => {
          console.log("success", response);
        });
    // });
  } catch (error) {
    console.error("Error in sendFall:", error);
  }
}

/**
 * Send notification to user
 * @param {Object} body
 */
// async function sendFall(body) {
//   try {
//     const token = body.token;
//     const message = {
//       token: token,
//       data: {
//         title: body.data.title,
//         patientEmail: body.data.patientEmail,
//         patientName: body.data.patientName,
//         address: body.data.address,
//         time: body.data.time,
//       },
//     };
//     await admin
//       .messaging()
//       .send(message)
//       .then((response) => {
//         console.log("success", response);
//       });
//   } catch (error) {
//     console.error("Error in sendFall:", error);
//   }
// }

exports.addObserverRequest = onRequest(async (req, res) => {
    try {
      const requestObserver = req.body;

      if (requestObserver.patientEmail == requestObserver.supervisorEmail) {
        res.json({
          success: false,
          error:
            "Tài khoản người theo dõi và người được theo dõi không thể trùng nhau",
        });
        return;
      }

      const isPatient = await checkIfPatient(requestObserver.patientEmail);
      if (!isPatient) {
        res.json({
          success: false,
          error: "Người bạn muốn theo dõi chưa đăng ký thiết bị",
        });
        return;
      }

      // Chuyển time sang kiểu date
      const time = new Date(requestObserver.time);
      requestObserver.time = time;
      // Thêm vào firestore
      await getFirestore()
        .collection("observer-request")
        .doc(
          `${requestObserver.supervisorEmail}_${requestObserver.patientEmail}`
        )
        .set(requestObserver);
      // Gửi tin nhắn đến các thiết bị đang đăng nhập vào tài khoản người bệnh
      const tokens = await getAccountToken(requestObserver.patientEmail);
      if (tokens) {
        await sendObserverRequest(tokens, requestObserver);
      }

      res.json({
        success: true,
        error: null,
      });
    } catch (error) {
      console.error("Error in addObserverRequest:", error);
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

/**
 * Checks if the user with the given email is a patient.
 * @param {string} patientEmail - The email of the user to check.
 * @return {Promise<boolean>} - Returns true if the user is a patient, otherwise false.
 */
async function checkIfPatient(patientEmail) {
  try {
    const document = await getFirestore()
      .collection("user")
      .doc(patientEmail)
      .get();
    if (!document.exists) {
      console.log("No document found for email:", patientEmail);
      return false; // No document found, user is not a patient
    }

    const role = document.data().role;
    return role === 1; // Assuming role 1 corresponds to a patient
  } catch (error) {
    console.error("Error in checkIfPatient:", error);
    return false; // On error, assume the user is not a patient
  }
}

/**
 * Retrieves a list of FCM tokens associated with a user's email.
 * @param {string} email - The email of the user to retrieve tokens for.
 * @return {Promise<string[] | null>} - Returns the token list or null if not found or error occurs.
 */
async function getAccountToken(email) {
  try {
    const document = await getFirestore().collection("user").doc(email).get();
    if (!document.exists) {
      console.log("No document found for email:", email);
      return null; // No document found for the provided email
    }

    const tokens = document.data().tokens;
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      console.log(
        "Tokens are not available or not in the expected format for email:",
        email
      );
      return null; // Tokens field is missing or not an array
    }

    return tokens; // Returns the array of tokens
  } catch (error) {
    console.error("Error in getAccountToken:", error);
    return null; // Error case, return null
  }
}

/**
 * Send notification to all tokens.
 * @param {string[]} tokens - The list of FCM tokens.
 * @param {Object} body - The Request observer.
 * @return {Promise<void>}
 */
async function sendObserverRequest(tokens, body) {
  console.log("Sending observer request to tokens:", tokens);

  const messages = {
    tokens: tokens,
    notification: {
      title: "Yêu cầu theo dõi",
      body: `Từ: ${body.supervisorEmail}\nThời gian: ${body.time}`,
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(messages);
    response.responses.forEach((resp, idx) => {
      if (resp.success) {
        console.log(`Successfully sent message to token: ${tokens[idx]}`);
      } else {
        console.error(
          `Failed to send message to token: ${tokens[idx]} - ${resp.error}`
        );
      }
    });
  } catch (error) {
    console.error("Error sending multicast message:", error);
  }
}

// exports.handleFallDetection = functions.https.onRequest((req, res) => {
//   if (req.method !== "POST") {
//     return res.status(405).send({error: "Method Not Allowed"});
//   }

//   const {token, data} = req.body;

//   if (!token) {
//     return res.status(400).send({error: "Token not provided in request"});
//   }

//   const messageTitle = data && data.title ? data.title : "Fall Detected!";
//   const messageBody =
//     data && data.body ?
//       data.body :
//       "Your fall has been detected. Are you okay?";

//   const message = {
//     to: token,
//     notification: {
//       title: messageTitle,
//       body: messageBody,
//     },
//   };

//   push_service.send(message, (err, response) => {
//     if (err) {
//       console.error("Error sending message:", err);
//       return res.status(500).send({error: "Failed to send notification"});
//     } else {
//       console.log("Notification sent successfully:", response);
//       return res
//           .status(200)
//           .send({success: true, message: "Notification sent successfully"});
//     }
//   });
// });
