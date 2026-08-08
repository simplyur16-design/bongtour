Option Explicit
Dim sh, bat, cmd
Set sh = CreateObject("WScript.Shell")
bat = "C:\Users\USER\Desktop\BONGTOUR\apps\simplyur-mobile\eas-ios-preview.bat"
cmd = "cmd.exe /c start ""simplyur-eas-ios"" /D ""C:\Users\USER\Desktop\BONGTOUR\apps\simplyur-mobile"" """ & bat & """"
sh.Run cmd, 1, False
