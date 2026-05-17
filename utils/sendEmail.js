import nodemailer from "nodemailer";

const sendEmail = async (email, subject, html) => {

const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: process.env.EMAIL,
pass: process.env.EMAIL_PASS
}
});

await transporter.sendMail({
from: process.env.EMAIL,
to: email,
subject,
html
});

};

export default sendEmail;