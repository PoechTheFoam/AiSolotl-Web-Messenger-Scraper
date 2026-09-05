//clearSavedConversations();
initialize();

// assuming that user has conversations + chats and previously chatted with sb in messenger layout
// assuming using full Messenger layout (not mini messenger in facebook layout)

async function initialize(){ 
    if (document.querySelector("div[id='jajajaggezbozo']")) return;
    const dupe_preventor=document.createElement("div");
    dupe_preventor.id='jajajaggezbozo';
    document.body.append(dupe_preventor);

    let chatRegion;
    let chatParent;
    let conversation
    let tables;
    let conversations={};
    let c_list_container;
    let c_list=[]; 
    let c_list_labelled={}
    let processing_list=[];
    let process_state="idle"; 

    async function initialize_chatRegion_and_conversation(){
        chatRegion= await waitForElement("div[role='log']");
        chatParent=chatRegion.parentElement;
        conversation=chatRegion.getAttribute("aria-label");
    }

    async function gatherData(){
        conversations=await loadConversations();
        c_list_labelled=await loadLabelledList();
        updateProcessingList(c_list_labelled);
    }

    gatherData() //signal this to fire when gather data button clicked


    /*console.log(await chrome.storage.local.get(null));
    console.log("conversastions: ",structuredClone(conversations));
    console.log("conversations: ",structuredClone(conversations));
    console.log("c_list_labelled: ",structuredClone(c_list_labelled))
    console.log("processing_list: ", structuredClone(processing_list))*/
    
    
    await initialize_chatRegion_and_conversation();
    await initialize_conversations();

    async function processConversation(conversation){
        let first_session=true
        let counter=0;
        let scrollAnchor=undefined;
        let cur_conv=chatRegion.getAttribute("aria-label")
        if (conversation!=cur_conv) return;
        function getMessagesData(conversation,tables){
        let output={}
        let innerCounter=0;
        for (const event of tables){
            const messageId=event.getAttribute("data-message-id");
            if (!messageId) continue;
            let conversation_keys;
            let exist_index=-1;
            if (conversations[conversation]){
                conversation_keys=Object.keys(conversations[conversation]);
                exist_index=conversation_keys.indexOf(messageId);
            }
            if (exist_index!=-1) continue;    
            
            if (innerCounter===0) {
                scrollAnchor=event;
                /*console.log("event: ",event)
                console.log("scrollAnchor: ",scrollAnchor);
                console.log("Is event connected to chatRegion?", chatRegion.contains(scrollAnchor));
                console.log("Is connected in general? ", scrollAnchor.isConnected);*/
            }
            const rawLabel= event.getAttribute("aria-label");

            let content= event.innerText.trim(); //
            
            let media="undefined";
            // case 1: stickers
            let sticker=event.querySelector("[role='img']");
            if (sticker){
                if (sticker.getAttribute("aria-label")!==" sticker") media="Sticker: "+sticker.getAttribute("aria-label");
                else {
                    let stickerLinkWrapper=event.style.getPropertyValue("background-image");
                    let stickerLink=stickerLinkWrapper.match(/url\((['"]?)(.*?)\1\)/);
                    media=stickerLink;
                }
            }

            //case 2: files
            let file=event.querySelector("[download]");
                if (file){
                    let mediaLink=file.getAttribute("href");
                    let file_name_frags=event.querySelectorAll("span[dir][style]");
                    let file_name="";
                    for (const frag of file_name_frags) file_name=file_name+frag.innerText+" ";
                    media="File/Attachment: "+JSON.stringify(file_name.trim()).replace(/\\n/g," ")+" "+mediaLink;
                }
            
            let total_hrefs=event.querySelectorAll("[role='link'][href]");
            let isNotImage=rawLabel.split(":").length-1>1;
            if (isNotImage){
                // case 4: Links/Other attachments
            if (!sticker&&!file){
                let links=event.querySelectorAll("[href]");
                if (links.length>0){
                    let cleaned_links=[...links].slice(0,-1);
                    let link_list={};
                    let link_counter=0;
                    for (const link of cleaned_links){
                        link_list["Link_"+link_counter]=link.innerText;
                        link_counter++;
                        };
                    link_counter=0;
                    media={"Links":link_list};
                }
            }
            }
            if (total_hrefs.length===1 && !isNotImage && !file) {
                // case 3: images
                let cand_image_container=event.querySelector("[role='link'][href]");
                let cand_images=cand_image_container.querySelectorAll("img[height]");
                let image;
                for (const img of cand_images){
                    if (img.getAttribute("alt").length>1) image=img;
                }
                if (image&&(!sticker&&!file)){
                    media="Image: "+image.getAttribute("src");
                }
            }

            
            
            /*console.log("------------------")
            console.log("Message "+innerCounter)
            console.log("Raw label: "+rawLabel)
            console.log("content: "+content);
            console.log("media: ", media);*/
            innerCounter++;
            output[messageId]={
            content:content,
            media:media
            };
        }
        let cur_conv=chatRegion.getAttribute("aria-label");
        if (conversation!=cur_conv) return {};
        return output;
        }
        if (first_session){
            while (first_session&&counter<7){
            scrollAnchor=undefined;
            tables = await waitForElementsSettle(chatRegion);
            //console.log("New data: ",structuredClone(getMessagesData(conversation,tables)));
            //console.log("Old data: ", structuredClone(conversations[conversation]))
            conversations[conversation]= {...(getMessagesData(conversation,tables)),...(conversations[conversation] ?? {})};
            //console.log("Data post-write: ",structuredClone(conversations[conversation]))
            if (!scrollAnchor&&Object.keys(conversations[conversation]??{}).length>0) {
                let anchorSelector=`[data-message-id="${Object.keys(conversations[conversation])[0]}"]`;
                //console.log("Inside 1st anchor check, chatRegion: ",chatRegion)
                //console.log("Inside 1st anchor check, anchorSelector: ",anchorSelector);
                scrollAnchor=chatRegion.querySelector(anchorSelector); // 
                //console.log("Inside 1st anchor check, scrollAnchor: ",scrollAnchor);
            }
            if (scrollAnchor){
                scrollAnchor?.scrollIntoView({
                block:"end",
                behavior:"smooth"
                })
                counter++;   
            }
            if (!scrollAnchor) {
                /*console.log("Maximum reached: "+counter);
                console.log("Inside invalid anchor check, chatRegion: ",chatRegion);
                console.log("Inside invalid anchor check, scrollAnchor written like 1st check: ", chatRegion.querySelector(`[data-message-id="${Object.keys(conversations[conversation])[0]}"]`))
                console.log("Inside invalid anchor check, scrollAnchor: ",scrollAnchor);
                console.log("Inside invalid anchor check, id of earliest message: ",Object.keys(conversations[conversation])[0]);*/
                for (const [key,value] of Object.entries(conversations[conversation])){console.log(key+": "+value.content)};
                break;
            }
        }
        if (counter===7){
            console.log("First session completed:  "+counter);
            console.log(scrollAnchor);
        }
        }
    }

    //place this inside signal sum_btn clicked
    if (process_state==="idle"){
                process_state="ongoing";
                await processConversation(conversation);
                await initialize_conversations();
                await nextConversation();
                if (process_state==="finished") obs.disconnect();
                else {
                    await initialize_chatRegion_and_conversation();
                    obs.disconnect();
                    obs.observe(chatRegion, {
                    childList: true,
                    attributes:true,
                    attributeFilter:["aria-label"],
                    subtree:true,
                    });
                    process_state="idle";
                }
                }

    const observer = new MutationObserver(async (mutations,obs)=>{
        for (const m of mutations){
            for (const node of m.removedNodes){
                if (node.role==="log"&&node.tagName==="div"){
                    if (process_state==="ongoing") {
                        conversations[conversation].clear();
                        await initialize_chatRegion_and_conversation();
                        obs.disconnect();
                        obs.observe(chatParent,{childList:true})
                        process_state="idle";
                    }
                }
            }
        }
    });            

    observer.observe(chatParent,{childList:true});

    async function nextConversation(){
        let next_convo_link;
        let current_identifer=find_current_identifier(c_list_labelled);
        c_list_labelled[current_identifer].processed=true; 
        await saveConversations(conversations,c_list_labelled);
        updateProcessingList(c_list_labelled); //shold remove current from the list.
        if (processing_list.length===0){
            end_observing=true;
            process_state="finished"
            return;
        } //no more convos to process
        let next_identifier=processing_list[0]; //always 
        next_convo_link=find_next_link(c_list_labelled,next_identifier);
        next_in_process=true;
        process_state="switching"
        window.location.href=next_convo_link;
        //find conv that has attr "current=true"
        //find index of that conv, go into the next conv/return depending on logic
    }

    function waitForElementsSettle2({stableForMs = 5000,timeoutMs = 15000} = {}) {
    return new Promise((resolve) => {
        const selector = "[aria-label][role='navigation']";

        let stableTimer;
        let timeoutTimer;

        function check() {
            clearTimeout(stableTimer);
                stableTimer = setTimeout(() => {
                    observer.disconnect();
                    clearTimeout(timeoutTimer);
                    console.log("resolved in check funct")
                    resolve(document.querySelectorAll(selector));
                }, stableForMs);
        }

        const observer = new MutationObserver(check);

        observer.observe(document, {
            childList: true,
            subtree: true
        });

        timeoutTimer = setTimeout(() => {
            observer.disconnect();
            clearTimeout(stableTimer);
            console.log("Conversations took too long to settle, continuing");
            console.log("timeout & resolved")
            resolve(document.querySelectorAll(selector));
        }, timeoutMs);

        check();
    });
    }

    function find_next_link(c_list_labelled,next_identifier){ //c_list contains cliclabke elements?
        for (const [key,value] of Object.entries(c_list_labelled)){
            if (key===next_identifier) return value.link;
        }
    }

    function find_current_identifier(c_list_labelled){
        console.log("C");
        for (const [key,value] of Object.entries(c_list_labelled)){
            if (value.current){
                console.log(key);
                console.log(value);
                return key
            }
        }
        console.log("D");
    }

    async function initialize_conversations(){
    console.log("A");
    c_list_container=[...await waitForElementsSettle2()]?.[2];
    console.log("B")
    console.log(c_list_container);
    if (c_list.length<11){ // prototype limitation
        let cand=c_list_container.querySelectorAll("a[role='link'][aria-current][href]");
        c_list=[...cand]; //prototype limitation
        for (const c of c_list){
            let c_is_current=false;
            let name;
            let spanList=c.querySelectorAll("span[dir]")
            for (const s of spanList){
                if (conversation.includes(s.innerText)) name=s.innerText;
            }
            console.log(conversation);
            console.log(name);
            if (conversation.includes(name)) c_is_current=true;
            console.log(c_is_current);
            let c_identifier=c.getAttribute("href");
            console.log(c_identifier);
            let c_link=`https://facebook.com${c_identifier}`;
            if (c_is_current){ //branching for loads
                if (c_list_labelled[c_identifier]) c_list_labelled[c_identifier].current=true; //don't know if this checks whether CLL exists correctly
                else c_list_labelled[c_identifier]={link:c_link,processed:false,current:true};
            }
            else {
                if (c_list_labelled[c_identifier]) c_list_labelled[c_identifier].current=false; //do not touch processed status for now
                else c_list_labelled[c_identifier]={link:c_link,processed:false,current:false};
            }
        }
        updateProcessingList(c_list_labelled);
        }
    }
    
}

function updateProcessingList(c_list_labelled){ //reconstruct to prevent duplicates.
    processing_list=[]
    for (const [key,value] of Object.entries(c_list_labelled)){
        if (!value.processed) processing_list.push(key); //c=identifier=href
    }
    //automatically updates when function's called when c_list_labelled has been altered
}

function delayWithInterruptions(){
    return new Promise((resolve)=>{
        let stableTimer;
        let timeoutTimer;
        const obs=new MutationObserver(()=>{
            clearTimeout(stableTimer);
            stableTimer=setTimeout(()=>{
                obs.disconnect();
                clearTimeout(timeoutTimer);
                resolve();
            },3000)
        });
        obs.observe(chatRegion,{childList:true,subtree:true});
        timeoutTimer=setTimeout(()=>{
            obs.disconnect;
            clearTimeout(stableTimer);
            console.log("Messages took too long to settle, continuing")
            resolve();
        },15000);
    })
}



function waitForElement(selector){
    return new Promise((resolve)=>{
        const element=document.querySelector(selector);
        if (element) return resolve(element);

    const observer=new MutationObserver((mutations,obs)=>{
        const target=document.querySelector(selector);
        if (target){
            obs.disconnect();
            resolve(target);
        }
    });
    observer.observe(document.body,{
        childList:true,
        subtree:true
    });
});
}


function waitForElementsSettle(chatRegion, {
    stableForMs = 5000,
    timeoutMs = 15000
} = {}) {
    return new Promise((resolve) => {
        const selector = '[data-scope="messages_table"]';

        let stableTimer;
        let timeoutTimer;

        function check() {
            clearTimeout(stableTimer);
                stableTimer = setTimeout(() => {
                    observer.disconnect();
                    clearTimeout(timeoutTimer);
                    resolve(chatRegion.querySelectorAll(selector));
                }, stableForMs);
        }

        const observer = new MutationObserver(check);

        observer.observe(chatRegion, {
            childList: true,
            subtree: true
        });

        timeoutTimer = setTimeout(() => {
            observer.disconnect();
            clearTimeout(stableTimer);
            console.log("Messages took too long to settle, continuing");
            resolve(chatRegion.querySelectorAll(selector));
        }, timeoutMs);

        check();
    });
}

async function saveConversations(conversations,c_list_labelled){
    const result=await chrome.storage.local.get("AISOLOTL");
    let AISOLOTL=result?.AISOLOTL ?? {}
    AISOLOTL.platform ??= {}
    AISOLOTL.platform["Messenger"]??= {}
    AISOLOTL.platform["Messenger"].conversations={...AISOLOTL.platform["Messenger"].conversations, ...conversations};
    AISOLOTL.platform["Messenger"].c_list_labelled={...AISOLOTL.platform["Messenger"].c_list_labelled, ...c_list_labelled};
    console.log("AFTER WRITING");
    console.log(AISOLOTL.platform["Messenger"].conversations);
    console.log(AISOLOTL.platform["Messenger"].c_list_labelled);
    console.log(AISOLOTL)
    await chrome.storage.local.set({
        AISOLOTL
    }).catch((error)=>{console.log(error)})
}

async function loadConversations(){
    const result=await chrome.storage.local.get("AISOLOTL");
    if (!result||!result.AISOLOTL||!result.AISOLOTL.platform||!result.AISOLOTL.platform["Messenger"]||!result.AISOLOTL.platform["Messenger"].conversations) return {}
    console.log(result.AISOLOTL.platform["Messenger"].conversations)
    return result.AISOLOTL.platform["Messenger"].conversations;
}

async function loadLabelledList(){
    const result=await chrome.storage.local.get("AISOLOTL");
    if (!result||!result.AISOLOTL||!result.AISOLOTL.platform||!result.AISOLOTL.platform["Messenger"]||!result.AISOLOTL.platform["Messenger"].c_list_labelled) return {}
    console.log(result.AISOLOTL.platform["Messenger"].c_list_labelled);
    return result.AISOLOTL.platform["Messenger"].c_list_labelled;
}

async function clearSavedConversations(){
    await chrome.storage.local.clear();
}