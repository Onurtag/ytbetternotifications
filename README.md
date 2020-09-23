## Youtube Better Notifications (Unsupported Alpha)  

**Youtube Better Notifications is a *userscript* that gives you a better view of your youtube notifications.**

This is an **unsupported project**. *Do not expect any support or new features* except for maybe large bugs or small tweaks.  
Feel free to fork and take over or use the code in any way.  

Only tested on **Firefox + Tampermonkey**.  

### Preview Image:  
![Preview](/Images/Preview2.png)  

___  

### **Usage Information**  

* By default, the userscript runs only on this url: https://www.youtube.com/new  

* After the first install, clicking the "Load All Notifications" button in the settings menu is recommended.  

* Email feature uses smtpjs.com. ***❗❗❗ Only use a fresh dummy account for this feature and assume that your password and account will be leaked***.   

Email setup example (for sending only to your gmail account FROM a fresh dummy gmail account):  
```
1. Create a new fake Gmail account with a random password that you dont use anywhere else

2. Enable less secure apps for your new google account (google how)

3. Go to smtpjs.com, click "Encrypt your SMTP Credentials" and enter the following: 
    SMTP Host: smtp.gmail.com
    SMTP Username: your email
    SMTP Password: your password
    Domain: *.gmail.com
    Use SSL: ✔
    Port: 587
After entering above settings click generate and save the exported token. You can leave smtpjs.com after getting your token.

4. Now you can input your token and other email settings into the Youtube Better Notifications options menu. Using the email template below for subject and body fields is recommended.

5. Click "Send test emails to send test emails to your destination account.
```

___  

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


___  

### 📚**Used libraries**  

 - Dexie + dexie-export-import
 - downloadjs
 - moment.js  

Many thanks to the developers.