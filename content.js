let chatRegion;
let conversation
let tables;
let conversations={};
let storedConversations = {};
let c_list_container;
let c_list=[];
let c_list_labeled={}; //c_list_labeled purely for checking processed status
let processing_list=undefined;
let current_index=0;
initialize();

async function initialize(){ 

    // assuming that user has conversations + chats and previously chatted with sb in messenger layout
    // assuming using full Messenger layout (not mini messenger in facebook layout)

    function waitForElementsSettle3(){
        
    }

    async function initialize_chatRegion_and_conversation(){
        chatRegion= await waitForElement("div[role='log']");
        conversation=chatRegion.getAttribute("aria-label");
    }
    
    await initialize_chatRegion_and_conversation();
    let chatRegion_old=chatRegion;
    let processing=false;
    let mutating=false;
    let next_in_process=false;
    let initialize_cr_c=false;

    async function processConversation(conversation){
        let found;
        let target_msg_id;
        let first_session=true
        if ((storedConversations[conversation])){
            if (storedConversations[conversation].length>0) first_session=false;
        }
        if (!first_session){
            found=false;
            target_msg_id=(storedConversations[conversation])?.at(-1)
        }
        let counter=0;
        let scrollAnchor=undefined;
        let cur_conv=chatRegion.getAttribute("aria-label")
        if (conversation!=cur_conv) return; //guard 1 for illegal convo
        function getMessagesData(conversation,tables){
        if (!storedConversations[conversation]) {
            storedConversations[conversation]=[];
        }
        let output={}
        let innerCounter=0;
        for (const event of tables){
            const messageId=event.getAttribute("data-message-id");
            if (!messageId) continue;

            if (messageId===target_msg_id) found=true;
            if (storedConversations[conversation].includes(messageId)) continue; //recheck this part if something breaks, such as asynchronous messages loading despite top-bottom order
            storedConversations[conversation].push(messageId);
            
            if (innerCounter===0) scrollAnchor=event;
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
            console.log("media: ", media);
            innerCounter++;*/
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
            conversations[conversation]= {...(getMessagesData(conversation,tables)),...(conversations[conversation] ?? {})};
            if (!scrollAnchor&&Object.keys(conversations[conversation]??{}).length>0) {
                let anchorSelector=`[data-message-id="${Object.keys(conversations[conversation])[0]}"]`;
                scrollAnchor=chatRegion.querySelector(anchorSelector);
            }
            if (scrollAnchor){
                scrollAnchor?.scrollIntoView({
                block:"end",
                behavior:"auto"
                })
                counter++;   
            }
            if (!scrollAnchor) {
                console.log("Maximum reached: "+counter);
                console.log(scrollAnchor);
                break;
            }
        }
        if (counter===7){
            console.log("First session completed:  "+counter);
            console.log(scrollAnchor);
        }
        }
        if (!first_session){
            while (!found){
                scrollAnchor=undefined;
                tables=await waitForElementsSettle(chatRegion);
                conversations[conversation]= {...(getMessagesData(conversation,tables)),...(conversations[conversation] ?? {})};
                if (found) {
                    console.log("Found target, stopping scroll");
                    break;
                }
                if (!scrollAnchor&&Object.keys(conversations[conversation]??{}).length>0) {
                let anchorSelector=`[data-message-id="${Object.keys(conversations[conversation])[0]}"]`;
                scrollAnchor=chatRegion.querySelector(anchorSelector);
            }
            if (scrollAnchor){
                scrollAnchor?.scrollIntoView({
                block:"end",
                behavior:"auto"
                })
            }
            if (!scrollAnchor) {
                console.error("Error loading earliest message");
                break;
            }
        }
        }
    }

    const observer = new MutationObserver(async (mutations,obs)=>{
        const childListMut= mutations.some(m=>m.type==="childList"); 
        const convMut=mutations.some(m=>(m.type==="attributes"&&m.target===chatRegion));
        if (childListMut||convMut){ //conversation changed || messages count modified
            console.log("mutating");
            mutating=true;
            if (((convMut)&& processing)&&!next_in_process){ //guard 2, during write to conversations
                conversations[conversation].clear();
                conversation=chatRegion.getAttribute("aria-label");
                //chatRegion.setAttribute("processed",false); //old chat region, doesn't exist in DOM anymore -> set at start
                processing=false;
                //needs process reminder somehow (reverse traversal)
            }
            //anything above processing=true in risk of being called multiple times
            while (mutating){
                mutating=false;
               if (!processing){
                processing=true;
                await processConversation(conversation);
                await initialize_conversations();
                nextConversation();
                await initialize_chatRegion_and_conversation();
                obs.disconnect();
                obs.observe(chatRegion, {
                childList: true,
                attributes:true,
                attributeFilter:["aria-label"],
                subtree:true,
                });
                processing=false;
                next_in_process=false;
                }
            }
        }
    });            
    observer.observe(chatRegion, {
        childList: true,
        attributes:true,
        attributeFilter:["aria-label"],
        subtree:true,
    });
    async function nextConversation(){
        let next_convo;
        find_current(c_list);
        //c_list_labeled[current_index].processed=true; //recheck this mapping scheme later -> may be unnecessary with processing_list
        processing_list[current_index]=true;
        let next_index=processing_list.indexOf(false);
        if (next_index===-1) return; //no more unprocesseds
        next_convo=c_list[next_index];
        next_in_process=true;
        next_convo.click();
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
    function find_current(c_list){
        console.log("C");
        c_list.forEach((c,index)=>{
            let name;
            if (c.hasAttribute("aria-label")) {
                name=c.getAttribute("aria-label");
                console.log(name);
            }
            else {
                let possible_spans=c.querySelectorAll("span[dir]");
                for (const s of possible_spans){
                    if (conversation.includes(s.innerText)) {
                        name=s.innerText;
                        console.log(name);
                        break;
                    }
                }
            }
            //c_list_labeled purely for checking processed status
            if (conversation.includes(name)) {c_list_labeled[index]={name:name,element:c,processed:false};current_index=index} //marking current c_list element
            else {c_list_labeled[index]={name:name,element:c,processed:false};}
        })

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
        if (!processing_list) processing_list=new Array(c_list.length).fill(false);
        if (processing_list&&processing_list.length<c_list.length) {
            let size_diff=c_list.length-processing_list.length;
            let tempArray=new Array(size_diff).fill(false);
            processing_list=[...tempArray];
        }
        }
    }
    
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
    stableForMs = 3000,
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