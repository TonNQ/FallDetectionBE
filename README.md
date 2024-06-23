### Cài đặt
#### 1. Clone dự án từ GitHub (nhánh feat/final)
`git clone -b feat/final https://github.com/TonNQ/FallDetectionBE.git`
#### 2. Cài đặt Firebase CLI
Mục đích của CLI là để deploy các hàm ta viết trong môi trường Node.js lên môi trường Cloud Function runtime của Google.
* Mở terminal của thư mục vừa clone về.
* Gõ lệnh `npm install -g firebase-tools` và nhấn enter.
* Chờ cho quá trình cài hoàn tất.
* Để update những thứ mới nhất của Firebase CLI và firebase function SDK, bạn có thể thực hiện hai lệnh sau:

`npm install firebase-functions@latest firebase-admin@latest --save`

`npm install -g firebase-tools`
#### 3. Cài Đặt Các Gói NPM
`cd functions`

`npm install`
#### 4. Đăng Nhập Firebase
`firebase login`
#### 5. Nếu có thay đổi code, thực hiện các lệnh sau để kiểm tra tại localhost hoặc deploy lên server Firebase
* Chạy Firebase Emulators (localhost):
`firebase emulators:start --only functions`
* Deploy Functions:
`firebase deploy --only functions`
