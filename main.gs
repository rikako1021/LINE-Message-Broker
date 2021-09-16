// @ts-nocheck
const ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("token");

const LOG_SHEET_NAME = 'ログ';
const SETTING_SHEET_NAME = '設定';
const SUBSCRIBER_SHEET_NAME = '通知先';

const ss = SpreadsheetApp.getActiveSpreadsheet();
const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
const settingSheet = ss.getSheetByName(SETTING_SHEET_NAME);
const subscriberSheet = ss.getSheetByName(SUBSCRIBER_SHEET_NAME);

function doPost(e) {
  
  const event = JSON.parse(e.postData.contents).events[0];
  
  const date = Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss');
  const userId = event.source.userId;
  const userProfile = getLineUserName(userId);
  const userName = userProfile.displayName;
  const userMessage = event.message.text;
  const rowContents = [date,userId,userName,userMessage];
  logSheet.appendRow(rowContents);
  
  // 設定シートのキーワードを含むかどうかで動作分岐
  const keywords = getKeywords();
  const replyMessage = keywords.includes(userMessage) ? register(userId,userName) : push(userMessage,userName,userId);

  const replyToken = event.replyToken;
  
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{
        'type': 'text',
        'text': replyMessage,
      }],
    }),
    });
  
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}

function register(userId,userName){
  const subscriber = getSubscriber();
  if(!subscriber.includes(userId)){
    
    const rowContents = [userId,userName];
    subscriberSheet.appendRow(rowContents);
    
    return '登録完了';  
    
  } else {
    
    return '既に登録済みです';  
    
  }
}

function push(userMessage,userName,userId){
  const subscriber = getSubscriber();
  if(subscriber.length === 0){
    return '通知先が登録されていません';
  }
  if(userId === '管理者のid'){
  try{
       UrlFetchApp.fetch('https://api.line.me/v2/bot/message/multicast', {
         'headers': {
           'Content-Type': 'application/json; charset=UTF-8',
           'Authorization': 'Bearer ' + ACCESS_TOKEN,
         },
         'method': 'post',
         'payload': JSON.stringify({
           'to': subscriber,
           'messages': [{
             'type': 'text',
             'text': `送信者: ${userName}\n本文: ${userMessage}`,
                        }],
         }),
       });
      return '送信完了';

  } catch(e) {
    console.error(e);
    return '送信に失敗しました';
  }
  } else {
    return '管理者ではありません';
}

function getLineUserName(userId){
  const response = UrlFetchApp.fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    'headers': {
      "Content-Type" : "application/json charset=UTF-8",
      'Authorization': 'Bearer ' + ACCESS_TOKEN,
    },
    'method': 'get'
    });
  
  return JSON.parse(response);
}

function getKeywords(){
  const keywords = settingSheet.getRange(2, 2).getValue().split(',');
  return keywords;
}

function getSubscriber(){
  
  const subscriberSheetLastRow = subscriberSheet.getLastRow();
  let subscriber = new Array();
  
  if(subscriberSheetLastRow > 1){
    subscriber = subscriberSheet.getRange(2, 1, subscriberSheetLastRow - 1,1).getValues().flat();
  }
  
  return subscriber;

}
