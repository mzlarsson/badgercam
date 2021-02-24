const settings = require('./settings')();
const logger = require('./logging')('email');
var nodemailer = require('nodemailer');

function sendEmail(receivers, subject, text, attachments = []){
    if (!settings.email || !settings.email.smtp){
        logger.error("Could not find email SMTP info: " + e + ". Skip sending...");
        return;
    }

    if (!verifySettingsFields(settings.email.smtp)){
        return;
    }

    // Use HTML newlines
    text = text.replaceAll(/\n/g, "<br>");

    const port = (settings.email.smtp.port ? settings.email.smtp.port : 465);
    const isSecure = (settings.email.smtp.secure !== undefined ? settings.email.smtp.secure : (port === 465));
    const transporter = nodemailer.createTransport({
        host: settings.email.smtp.host,
        port: port,
        secure: isSecure,
        auth: {
          user: settings.email.smtp.address,
          pass: settings.email.smtp.password
        }
    });

    const mailOptions = {
        from: `"BadgerCam" ${settings.email.smtp.address}`,
        to: receivers.join(", "),
        subject: subject,
        html : text,
        attachments: attachments
    };

    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            logger.error("Failed to send mail: " + err);
        }
        else {
            logger.info("Sent email notification to " + receivers.join(", "));
        }
    });
}

function verifySettingsFields(smtp){
    if (!smtp.host){
        logger.error("No SMTP host given in settings file");
        return false;
    }

    if (!smtp.address){
        logger.error("No address given in settings file");
        return false;
    }

    if (!smtp.password){
        logger.error("No SMTP host given in settings file");
        return false;
    }

    return true;
}

exports.send = sendEmail;


/* Simple test program. Run by issuing 'node email.js' */
if (require.main === module){
    if (!settings.sync || !settings.sync.email || settings.sync.email.length == 0 ||
        !settings.email || !settings.email.smtp || !verifySettingsFields(settings.email.smtp)){
        console.log("Please configure email send and receive options in settings.json");
        return;
    }

    let destination = settings.sync.email;
    sendEmail(destination, "Test", "This is a test email\n\nThis is two lines down\nAint life wonderful?\n\nBest regards,\nBadgerCam Test Program");
}