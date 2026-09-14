/*platform="messenger";
conversations={}

chrome.runtime.onMessage.addListener((message)=>{
    conversations=message.storedConversations;
})

const localServerUrl="http://127.0.0.1:8000";

let payload={
    platform:platform,
    conversations:conversations
}*/
chrome.runtime.onInstalled.addListener(async()=>{
    await chrome.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"
});
})