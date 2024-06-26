# YtBetterNotifications (Unsupported Alpha)  

**YtBetterNotifications is a browser *userscript* that gives you a better view of your youtube notifications.**  

This is an **unsupported project**. *Do not expect any support or new features* except for maybe large bugs or small tweaks.  
Feel free to fork and take over or use the code in any way.  

Only tested on Firefox with Tampermonkey but it works in Chromium browsers as well.  

**Install link**  is at the bottom of this readme.  

### **Preview Image:**  
![Preview](/Images/Preview3.png)  

# 🌟**Usage Information**  

* By default, the userscript only runs on the following url: **`https://www.youtube.com/new`**  

* After the first install, clicking the **"Load All Notifications"** button in the settings menu is recommended.  
If you are planning to use email notifications, you should do this step **before** doing the email setup steps below.  

### **Steps to setup your email notifications (for Gmail only):**  

***Reminder**: Click the **"Load All Notifications"** button before setting up your email notifications.*

1. Create a new dummy Gmail account for this purpose (highly suggested) or use your existing account

2. Go to the link below, Click the "Enable API" buttons and copy the "Client ID" and "Secret" (or API key) values  
```https://developers.google.com/gmail/api/quickstart/js```

3. Enter those values into the YtBetterNotifications settings menu. Click the authorize button to authorize the application. Don't forget to save using the save button below.  

4. Go to the link below and click the first "OAuth Client" item (with today's date)  
```https://console.developers.google.com/apis/credentials```  
Add ```https://www.youtube.com``` to the Authorized JavaScript origins list.  

1. Copy the Email **Subject Template** and **Body Template** below and paste them into the subject and body fields that are on the YtBetterNotifications settings menu.
You can modify them if you wish. Don't forget to save using the save button below.  

6. Click "Send test emails" to send some test emails to your destination account.  

</details>

### **Example Email template:**  

<details>
<summary>
Subject Template (Click to Expand)
</summary>

```
DUMMYLIVEICONDUMMYCHANNELNAME 🔹 DUMMYVIDEOTITLE ⏤ Youtube
```

</details>

<details>
<summary>
Body Template (Click to Expand)
</summary>

```html
<table valign="top" style="margin-top:14px" width="680" cellspacing="0" cellpadding="0" border="0" bgcolor="transparent" align="center"> <tbody> <tr> <td width="40"></td> <td width="600"> <table width="600" cellspacing="0" cellpadding="0" border="0" align="center"> <tbody> <tr> <td> <table valign="center" width="600" cellspacing="0" cellpadding="0" border="0" align="left"> <tbody> <tr> <td width="584" valign="center"> <a target="_blank" href="https://www.youtube.com/"><img src="https://www.gstatic.com/youtube/img/branding/youtubelogo/1x/youtubelogo_60.png" style="display:block" height="30" border="0"></a> </td> </tr> </tbody> </table> </td> </tr> <tr> <td height="20"></td> </tr> <tr> <td> <table valign="center" width="600" cellspacing="0" cellpadding="0" border="0" align="center"> <tbody> <tr> <td> <table width="600" cellspacing="0" cellpadding="0" border="0" align="center"> <tbody> <tr> <td colspan="3"> <a style="text-decoration:none;display:block" class="nonplayable" target="_blank" href="DUMMYVIDEOURL"> <table style="background-repeat:no-repeat;background-size:cover;background-position:center" width="600" height="338" cellspacing="0" cellpadding="0" border="0" background="DUMMYVIDEOIMAGEURL" align="center"> <tbody> <tr> <td> <img src="https://www.gstatic.com/youtube/img/email/transparent_pixel.png" style="max-height:300px" data-image-whitelisted="" alt="DUMMYVIDEOTITLE" width="600"> </td> </tr> <tr scope="row"> <td style="color:#fff;text-align:right;font-size:12px" width="600" valign="bottom"> <div style="margin-bottom:8px;margin-right:8px;border-radius:2px;background-color:#212121;padding:2px 4px;display:inline-block">DUMMYVIDEOLENGTH</div> </td> </tr> </tbody> </table> </a> </td> </tr> <tr> <td> <table height="16" cellspacing="0" cellpadding="0" border="0"> <tbody> <tr> <td height="16"></td> </tr> </tbody> </table> </td> </tr> <tr> <td> <table style="table-layout:fixed" width="560" cellspacing="0" cellpadding="0" border="0"> <tbody> <tr> <td style="vertical-align:top" width="48"> <a target="_blank" href="DUMMYCHANNELURL"> <img style="display:block;border-radius:50%" data-image-whitelisted="" src="DUMMYCHANNELIMAGEURL" width="48" border="0"> </a> </td> <td width="16"></td> <td> <table style="table-layout:fixed" width="540" cellspacing="0" cellpadding="0" border="0"> <tbody> <tr> <td valign="center"> <table style="table-layout:fixed" cellspacing="0" cellpadding="0" border="0"> <tbody> <tr> <td style="padding-bottom:4px"> <a style="text-decoration:none" target="_blank" href="DUMMYVIDEOURL"> <span valign="center" style="font-family:Roboto,sans-serif;font-size:14px;color:#212121;line-height:20px"> DUMMYVIDEOTITLE </span> </a> </td> </tr> <tr> <td> <a style="font-family:Roboto,sans-serif;font-size:12px;color:#757575;line-height:16px;letter-spacing:0;text-decoration:none" target="_blank" href="DUMMYCHANNELURL"> DUMMYCHANNELNAME </a> </td> </tr> </tbody> </table> </td> </tr> </tbody> </table> </td> </tr> </tbody> </table> </td> </tr> <tr> <td> <table height="16" cellspacing="0" cellpadding="0" border="0"> <tbody> <tr> <td height="16"></td> </tr> </tbody> </table> </td> </tr> </tbody> </table> </td> </tr> </tbody> </table> </td> </tr> <tr> <td> <hr style="display:block;height:1px;border:0;border-top:1px solid #eaeaea;margin-bottom:16px;padding:0"> </td> </tr> </tbody> </table> </td> <td width="40"></td> </tr> </tbody> </table>
```

</details>


# 💠**Installation**  

You can install the auto updated version with [**this link**](https://github.com/Onurtag/ytbetternotifications/raw/master/YtBetterNotifications.user.js).  


# 📚**Used libraries**  

 - [Dexie + dexie-export-import](https://github.com/dfahlander/Dexie.js)  
 - [FileSaver.js](https://github.com/eligrey/FileSaver.js)  
 - [moment.js](https://github.com/moment/moment/)  
 - [js-base64](https://github.com/dankogai/js-base64/)  

Many thanks to the developers.
