initialize();
// assuming that user has conversations + chats and previously chatted with sb in messenger layout
// assuming using full Messenger layout (not mini messenger in facebook layout)

async function initialize(){ 
    let chatRegion;
    let chatParent;
    let conversation
    let tables;
    let conversations={};
    let c_list_container;
    let c_list=[]; 
    let c_list_labelled={}
    let processing_list=[];
    let popup_state;
    let popup_data;
    let process_state;
    let scroll_amt;
    let frame;

    let timer;
    let timeout_timer;
    let pick_conv_observer=undefined;


    chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
        if (request.signal==="clear"){(
            async()=>{
                await saveSignals({init_signal:"initializing"})
                await clearLocalStorage();
                await gatherData()
                await saveSignals({init_signal:"finished"})
            })();
        }
        if (request.signal==="pick_conv"){
            (async ()=>{
            addCheckboxes(c_list);
            await saveSignals({conv_signal:"waiting for user input"});
            if (!pick_conv_observer){
                pick_conv_observer=new MutationObserver((mutations, obs)=>{
                console.log("c_list_container mutation detected");
                //maybe add code here for target=checkbox later
                clearTimeout(timer);
                timer=setTimeout(async ()=>{
                    await updateCheckboxes();
                },100)
            })
            pick_conv_observer.observe(c_list_container,{
                childList:true,
                subtree:true
            })
            
            c_list_container.addEventListener("change",async(event)=>{
                console.log("checkbox change detected");
                const target=event.target;
                if (!target.classList.contains("conv_picker")) return;
                const id=target.id;
                c_list_labelled[id].chosen=target.checked;
                await saveConversations(conversations,c_list_labelled)

                console.log("p_list before update: ",structuredClone(processing_list));
                updateProcessingList(c_list_labelled);
                console.log("p_list after update: ",structuredClone(processing_list));
                if (processing_list.length>0) {
                    console.log("SAVING FINISHED");
                    await saveSignals({conv_signal:"finished"});
                }
                else {
                    console.log("SAVING SIGNAL")
                    await saveSignals({conv_signal:"waiting for user input"})
                }
                for (const [key,value] of Object.entries(c_list_labelled)){
                    if (value.chosen) console.log("Conv ",key,": ",value.chosen);
                }
            });
            }
            })();
        }

        if (request.signal==="input_scroll_amt"){(
            async()=>{
                scroll_amt=request.scroll_amt;
                await saveScroll_amt(scroll_amt);
                await saveSignals({scroll_amt_signal:"finished"});
            }
        )()}

        if (request.signal==="sum_start"){
            // users may spam sum_btn -> multiple async functions fire; need cooldown

            // start scrolling convos + switching convos here
            // save the data
            // send data back to Python backend here
            (async()=>{
                await saveState("ongoing");
                popup_state="initializing"
                await savePopup_state(popup_state);
                popup_data=null;
                await savePopup_data(popup_data)
                
                createPopup();
                //check if processing_list[0] is current
                let c=processing_list[0] //initially this is always guaranteed true
                let is_current_conversation=is_identifier_current(c);
                if (!is_current_conversation){
                    let next_convo_link;
                    next_convo_link=find_next_link(c_list_labelled,c);
                    console.log("p_list before switching (1st): ",structuredClone(processing_list))
                    window.location.href=next_convo_link;
                    return;
                }
                //this branch is of the current convo is in processing_list, checked by 1st occurrence for simplicity.
                let conversation_finished=await processConversation(conversation);
                if (!conversation_finished){
                    console.error("Conversation processing failed:", c);
                    return;
                }
                c_list_labelled[c].processed=true;
                await saveConversations(conversations,c_list_labelled);
                console.log("p_list before updating: ",structuredClone(processing_list))
                updateProcessingList(c_list_labelled);
                console.log("p_list after updating: ",structuredClone(processing_list))
                if (processing_list.length===0){
                    console.log("No more to process")
                    await saveConversations(conversations,c_list_labelled);
                    conversations=await loadConversations();
                    await send_data(conversations);
                    await clearLocalStorage();
                    await saveSignals({sum_signal:"finished"})
                    await saveState("idle")
                    return;
                }
                let next_c=processing_list[0];
                let next_convo_link=find_next_link(c_list_labelled,next_c);
                console.log("p_list before switching (2nd): ",structuredClone(processing_list))
                window.location.href=next_convo_link;
            })();
        }
    })


    await gatherData();
    console.log("Processing list: ",structuredClone(processing_list));
    console.log("State: ",structuredClone(process_state));

    await saveSignals({init_signal:"finished"});
    if (process_state==="ongoing"){
        if (processing_list.length===0){
            console.log("No more to process")
            await saveConversations(conversations,c_list_labelled);
            conversations=await loadConversations();
            await send_data(conversations);
            await clearLocalStorage();
            await saveSignals({sum_signal:"finished"})
            await saveState("idle")
            return;
        }
        await processConversation(conversation);
        //current identifier=that of the conversation -> both are currently displayed
        let c= find_current_identifier(c_list_labelled);
        if (!c){
            console.error("No matching conversation identifier");
            return;
        }
        c_list_labelled[c].processed=true;
        await saveConversations(conversations,c_list_labelled);
        updateProcessingList(c_list_labelled);
        if (processing_list.length===0){
            conversations=await loadConversations();
            await send_data(conversations);
            await clearLocalStorage();
            await saveSignals({sum_signal:"finished"});
            await saveState("idle")
            return;
        }
        let next_c=processing_list[0];
        let next_convo_link=find_next_link(c_list_labelled,next_c);
        window.location.href=next_convo_link;
        return;
    }


    async function initialize_chatRegion_and_conversation(){
        chatRegion= await waitForElement("div[role='log']");
        chatParent=chatRegion.parentElement;
        conversation=chatRegion.getAttribute("aria-label");
        const observer = new MutationObserver(async (mutations,obs)=>{
        for (const m of mutations){
            console.log("chatParent mutation detected")
            for (const node of m.removedNodes){
                if (node.getAttribute?.("role")==="log"&&node.tagName==="DIV"){
                    if (process_state==="ongoing") {
                        conversations[conversation]={};
                        obs.disconnect();
                        await initialize_chatRegion_and_conversation();
                        process_state="idle";
                        //unfinished edge case
                    }
                }
            }
        }
    });            

    observer.observe(chatParent,{childList:true,subtree:true});
    }

    async function gatherData(){
        await initialize_chatRegion_and_conversation();
        signals=await loadSignals();
        conversations=await loadConversations();
        c_list_labelled=await loadLabelledList();
        popup_state=await loadPopup_state();
        process_state=await loadState();
        scroll_amt=await loadAmt();
        popup_data=await loadPopup_data();
        popup_state=await loadPopup_state();
        if (popup_state!=="idle") createPopup();
        
        await saveConversations(conversations,c_list_labelled);
        updateProcessingList(c_list_labelled);
        await initialize_conversations();
    }

    async function updateCheckboxes(){
        refreshConvos();
        addCheckboxes();
    }

    function refreshConvos(){
        const selector = "[aria-label][role='navigation']";
        c_list_container=[...document.querySelectorAll(selector)]?.[2];
        let cand=c_list_container.querySelectorAll("a[role='link'][aria-current][href]")
        c_list=[...cand];
        for (const c of c_list){
            let c_identifier=c.getAttribute("href");
            let c_link=`https://facebook.com${c_identifier}`;
            if (!c_list_labelled[c_identifier]) c_list_labelled[c_identifier]={link:c_link,processed:false,chosen:false};
    }
        updateProcessingList(c_list_labelled);
    }

    function addCheckboxes(){
        for (const [key,value] of Object.entries(c_list_labelled)){
            let c=document.querySelector(`[href="${key}"]`)
            if (!c) continue;
            let prev=c?.previousElementSibling;
            let checkbox;
            if (!prev?.classList?.contains("conv_picker")){
                checkbox=document.createElement("input");
                checkbox.type="checkbox";
                checkbox.classList.add("conv_picker");
                checkbox.id=key;
                c.before(checkbox);
            }
            else checkbox=prev;
            checkbox.checked=value.chosen;
        }
    }


    //note this architecture in md later (no calling async for message listener's callback function)

    //replace onMessage listener with local storage listener? (message sending is not persistent)
    //notes on this in md

    /*console.log(await chrome.storage.local.get(null));
    console.log("conversations: ",structuredClone(conversations));
    console.log("conversations: ",structuredClone(conversations));
    console.log("c_list_labelled: ",structuredClone(c_list_labelled))
    console.log("processing_list: ", structuredClone(processing_list))*/
    

    async function processConversation(conversation){
        let first_session=true
        let counter=0;
        let scrollAnchor=undefined;
        let cur_conv=chatRegion.getAttribute("aria-label")
        if (conversation!=cur_conv) {
            console.log("mismatch encountered: passed convo:",conversation," and current: ",cur_conv);
            return false;
        }
        console.log("Beginning gathering messages data");
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
            
            let media={};
            // case 1: stickers
            let sticker=event.querySelector("[role='img']");
            if (sticker){
                media.type="sticker"
                if (sticker.getAttribute("aria-label")!==" sticker") media.name=sticker.getAttribute("aria-label");
                else {
                    let stickerLinkWrapper=event.style.getPropertyValue("background-image");
                    let stickerLink=stickerLinkWrapper.match(/url\((['"]?)(.*?)\1\)/);
                    media.url=stickerLink?.[2]
                }
            }

            //case 2: files
            let file=event.querySelector("[download]");
                if (file){
                    media.type="file/attachment"
                    let mediaLink=file.getAttribute("href");
                    let file_name_frags=event.querySelectorAll("span[dir]");
                    let file_name="";
                    file_name=file_name+file_name_frags[1].innerText+" "+file_name_frags[2]+" ";
                    media.name=JSON.stringify(file_name.trim()).replace(/\\n/g," ")
                    media.url=mediaLink;
                    //fix/verify this later to see if [0] is consistently the file name
                }
            
            let total_hrefs=event.querySelectorAll("[role='link'][href]");
            let isNotImage=rawLabel.split(":").length-1>1;
            if (isNotImage){
                // case 4: Links/Other attachments
            if (!sticker&&!file){
                let links=event.querySelectorAll("a[href]");
                if (links.length===0) media={}
                if (links.length>0){
                    media.type="links/other"
                    let cleaned_links=[...links].slice(0,-1);
                    let link_list={};
                    let link_counter=0;
                    for (const link of cleaned_links){
                        link_list["Link_"+link_counter]=link.innerText;
                        link_counter++;
                        };
                    link_counter=0;
                    media.urls=link_list;
                }
            }
            }
            if (total_hrefs.length===1 && !isNotImage && !file) {
                // case 3: images
                media.type="image"
                let cand_image_container=event.querySelector("[role='link'][href]");
                let cand_images=cand_image_container.querySelectorAll("img[height]");
                let image;
                for (const img of cand_images){
                    if (img.getAttribute("alt").length>1) image=img;
                }
                if (image&&(!sticker&&!file)){
                    media.url=image.getAttribute("src")
                }
            }

            
            /*
            console.log("------------------")
            console.log("Message "+innerCounter)
            console.log("Raw label: "+rawLabel)
            console.log("content: "+content);
            console.log("media: ", media);
            */
            innerCounter++;
            output[messageId]={
            rawLabel:rawLabel,
            content:content,
            media:media
            };
        }
        let cur_conv=chatRegion.getAttribute("aria-label");
        if (conversation!=cur_conv) return {};
        return output;
        }
        if (first_session){
            while (first_session&&counter<scroll_amt){
            scrollAnchor=undefined;
            tables = await waitForElementsSettle(chatRegion);
            //console.log("New data: ",structuredClone(getMessagesData(conversation,tables)));
            //console.log("Old data: ", structuredClone(conversations[conversation]))
            conversations[conversation]= {...(getMessagesData(conversation,tables)),...(conversations[conversation] ?? {})};
            console.log("Data post-write: ",structuredClone(conversations[conversation]))
            if (!scrollAnchor&&Object.keys(conversations[conversation]??{}).length>0) {
                let anchorSelector=`[data-message-id="${Object.keys(conversations[conversation])[0]}"]`;
                /*console.log("Inside 1st anchor check, chatRegion: ",chatRegion)
                console.log("Inside 1st anchor check, anchorSelector: ",anchorSelector);*/
                scrollAnchor=chatRegion.querySelector(anchorSelector); 
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
                console.log("Maximum reached: "+counter);
                console.log("Inside invalid anchor check, chatRegion: ",chatRegion);
                console.log("Inside invalid anchor check, scrollAnchor written like 1st check: ", chatRegion.querySelector(`[data-message-id="${Object.keys(conversations[conversation])[0]}"]`))
                console.log("Inside invalid anchor check, scrollAnchor: ",scrollAnchor);
                console.log("Inside invalid anchor check, id of earliest message: ",Object.keys(conversations[conversation])[0]);
                for (const [key,value] of Object.entries(conversations[conversation])){console.log(key+": "+value.content)};
                return false;
            } //no completion checks/verification here
        }
        if (counter===scroll_amt){
            console.log("First session completed:  "+counter);
            /*for (const [id, message] of Object.entries(conversations[conversation])) {
                console.log(id, message.rawLabel, message.content);
            }*/
        }
        }
        return true;
    }

    function waitForElementsSettle2({stableForMs = 5000,timeoutMs = 30000} = {}) {
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
        let current_conversation=location.pathname
        for(const [key] of Object.entries(c_list_labelled)){
            if (current_conversation.includes(key)) return key;
        }
    }

    function is_identifier_current(c_identifier){
        console.log("C")
        let current_conversation=location.pathname
        if (current_conversation.includes(c_identifier)) return true;
        console.log("D");
    }

    function remove_whitespace(str){
        return (str ?? "").replace(/\s+/g, "");
    }

    function normalize_text(str){
        return (str ?? "")
        .normalize("NFKC")
        .replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
    }

    async function initialize_conversations(){
    c_list_container=[...await waitForElementsSettle2()]?.[2];
    let cand=c_list_container.querySelectorAll("a[role='link'][aria-current][href]");
    c_list=[...cand];
    for (const c of c_list){
        let c_identifier=c.getAttribute("href");
        let c_link=`https://facebook.com${c_identifier}`;
        if (!c_list_labelled[c_identifier]) c_list_labelled[c_identifier]={link:c_link,processed:false,chosen:false};
    }
        updateProcessingList(c_list_labelled);
    }
    
    function updateProcessingList(c_list_labelled){ //reconstruct to prevent duplicates.
    processing_list=[]
    for (const [key,value] of Object.entries(c_list_labelled)){
        if (!value.processed&&value.chosen) {
            processing_list.push(key); //c=identifier=href
            console.log("In queue for processing: ",key," chosen: ",value.chosen)
        }
    }
    //automatically updates when function's called when c_list_labelled has been altered
    }

    async function delay(ms){
        return new Promise((resolve)=>setTimeout(resolve,ms));
    }

    async function send_data(conversation_sent){
        await resetConversationAttributes();
        const payload={
            platform:"Messenger",
            conversations:conversation_sent
        }
        console.log("Sending payload: ", structuredClone(payload));
        let amt=0;
        const max_amt=3;
        while (amt<=max_amt){
            try{
            const response= await fetch("http://localhost:8000/summarize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
            console.log("Response status: ",response.status);
            popup_data=await response.json();
            console.log("Backend response: ",popup_data)
            if (!response.ok){
                //HTTP failure: server responded with 4xx or 5xx; or request reached backend but it failed/rejected
                if (amt>max_amt){
                    await savePopup_data(popup_data);
                    popup_state="error"
                    await savePopup_state(popup_state);
                }
                amt++;
                await delay(3000);
                continue;
            }
            else {
                await savePopup_data(popup_data);
                popup_state="finished"
                await savePopup_state(popup_state);
                return;
            };
            
        }catch(error){
            if (amt>max_amt){
                await savePopup_data(popup_data);
                popup_state="error"
                await savePopup_state(popup_state);
            }
            //permissions failure/backend unavailable/network failure
            amt++;
            await delay(3000);
            continue;
        }
        }
        return;
    }

    async function resetConversationAttributes(){
        for (const [key,value] of Object.entries(c_list_labelled)){
            value.processed=false;
            value.chosen=false;
        }
        await saveConversations(conversations,c_list_labelled);
    }

    async function clearConversationData(){
        const result=await chrome.storage.local.get("AISOLOTL");
        let AISOLOTL=result?.AISOLOTL ?? {}
        AISOLOTL.platform ??= {}
        AISOLOTL.platform["Messenger"]??= {}
        AISOLOTL.platform["Messenger"].conversations={};
        conversations={}
        c_list_labelled={}
        await chrome.storage.local.set({AISOLOTL});    
    }

    async function clearLocalStorage(){
        conversations={}
        c_list_labelled={}
        let AISOLOTL={platform:{"Messenger":{}}}
        await chrome.storage.local.set({AISOLOTL});
    }

    function setupDragging(widget, header, minimizeBtn, frame) {
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener("mousedown", (event) => {
            if (event.target === minimizeBtn) return;

            dragging = true;

            const rect = widget.getBoundingClientRect();

            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;

            // Stop using centering transform after user starts dragging
            widget.style.transform = "none";
            widget.style.left = `${rect.left}px`;
            widget.style.top = `${rect.top}px`;

            event.preventDefault();
            frame.style.pointerEvents = "none";
        });

        document.addEventListener("mousemove", (event) => {
            if (!dragging) return;

            let x = event.clientX - offsetX;
            let y = event.clientY - offsetY;

            // Prevent the widget from disappearing off-screen
            const maxX = window.innerWidth - widget.offsetWidth;
            const maxY = window.innerHeight - header.offsetHeight;

            x = Math.max(0, Math.min(x, maxX));
            y = Math.max(0, Math.min(y, maxY));

            widget.style.left = `${x}px`;
            widget.style.top = `${y}px`;
        });

        document.addEventListener("mouseup", () => {
            dragging = false;
            frame.style.pointerEvents = "auto";
        });
    }

    function setupMinimize(widget, frame, button) {
        let minimized = false;

        button.addEventListener("click", (event) => {
            event.stopPropagation();

            minimized = !minimized;

            if (minimized) {
                frame.style.display = "none";
                button.textContent = "+";
                button.title = "Expand";
            } else {
                frame.style.display = "block";
                button.textContent = "−";
                button.title = "Minimize";
            }
        });
    }

    function createPopup(){
        // needs check for previous popups' existence
        if (!frame){
            const widget = document.createElement("div");
            widget.id = "aisolotl_widget";

            const header = document.createElement("div");
            header.id = "aisolotl_widget_header";

            const title = document.createElement("span");
            title.textContent = "AiSolotl";

            const minimizeBtn = document.createElement("button");
            minimizeBtn.textContent = "−";

            minimizeBtn.title = "Minimize";
            frame=document.createElement("iframe")
            frame.src=chrome.runtime.getURL("src/summary/summary.html")
            frame.id="summary_popup"

            Object.assign(frame.style, {
            width: "100%",
            height: "520px",
            maxHeight: "80vh",

            border:"none",
            backgroundColor:"#242526",
            
            display:"block"
            });

            Object.assign(widget.style, {
                position: "fixed",
                top: "30px",
                left: "50%",
                transform: "translateX(-50%)",

                width: "380px",

                zIndex: "2147483647",

                border: "1px solid #5a5b5c",
                borderRadius: "14px",
                backgroundColor: "#242526",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.55)",
                
                overflow: "hidden"
            });

            Object.assign(header.style, {
                height: "38px",
                padding: "0 12px",

                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",

                background: "#18191a",
                color: "#e4e6eb",

                fontFamily: "Arial, sans-serif",
                fontSize: "14px",
                fontWeight: "600",

                cursor: "move",
                userSelect: "none"
            });

            Object.assign(minimizeBtn.style, {
                background: "none",
                border: "none",
                color: "#e4e6eb",
                fontSize: "20px",
                cursor: "pointer"
            });


            header.appendChild(title);
            header.appendChild(minimizeBtn);

            widget.appendChild(header);
            widget.appendChild(frame);

            document.body.appendChild(widget);

            setupMinimize(widget, frame, minimizeBtn);
            setupDragging(widget, header, minimizeBtn,frame);
        }
        return;
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
    observer.observe(document.documentElement,{
        childList:true,
        subtree:true
    });
});
}


function waitForElementsSettle(chatRegion, {stableForMs = 5000, timeoutMs = 30000} = {}) {
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
    await saveSaving_convo(true);
    const result=await chrome.storage.local.get("AISOLOTL");
    let AISOLOTL=result?.AISOLOTL ?? {}
    AISOLOTL.platform ??= {}
    AISOLOTL.platform["Messenger"]??= {}
    AISOLOTL.platform["Messenger"].conversations={...(AISOLOTL.platform["Messenger"].conversations ?? {}), ...conversations};
    AISOLOTL.platform["Messenger"].c_list_labelled={...(AISOLOTL.platform["Messenger"].c_list_labelled ?? {}), ...c_list_labelled};
    /*console.log("AFTER WRITING");
    console.log(AISOLOTL.platform["Messenger"].conversations);
    console.log(AISOLOTL.platform["Messenger"].c_list_labelled);
    console.log(AISOLOTL)*/
    await chrome.storage.local.set({AISOLOTL}).catch((error)=>{console.log(error)})
    await saveSaving_convo(false);
}

async function saveScroll_amt(amt_saved){
    const result=await chrome.storage.session.get("AISOLOTL");
    let AISOLOTL=result?.AISOLOTL?? {};
    AISOLOTL.platform ??={}
    AISOLOTL.platform["Messenger"] ??={}
    AISOLOTL.platform["Messenger"].scroll_amt=amt_saved;
    await chrome.storage.session.set({AISOLOTL});
}

async function saveSignals(signals_saved){ // signals are different to signals sent in chrome.sendMessage
    const result=await chrome.storage.session.get("AISOLOTL");
    let AISOLOTL=result?.AISOLOTL?? {};
    AISOLOTL={...AISOLOTL,
                signals:{...(AISOLOTL.signals?? {}),...signals_saved}
    };
    console.log(AISOLOTL)
    await chrome.storage.session.set({AISOLOTL:AISOLOTL});
}

async function saveState(state_saved){
    const result=await chrome.storage.session.get("AISOLOTL");
    let AISOLOTL=result?.AISOLOTL ?? {}
    AISOLOTL.platform ??= {}
    AISOLOTL.platform["Messenger"]??= {}
    AISOLOTL.platform["Messenger"].process_state=state_saved;
    await chrome.storage.session.set({AISOLOTL});
}

async function saveSaving_convo(saving_convo_saved){
    await chrome.storage.session.set({saving_convo:saving_convo_saved});    
}

async function savePopup_state(popup_state_saved){
    await chrome.storage.session.set({popup_state:popup_state_saved});
}

async function savePopup_data(popup_data_saved){
    await chrome.storage.session.set({popup_data:popup_data_saved});
}

async function loadPopup_state(){
    const result=await chrome.storage.session.get("popup_state")
    if (!result||!result.popup_state) return "idle";//idle means not to be shown
    return result.popup_state;
}

async function loadPopup_data(){
    const result=await chrome.storage.session.get("popup_data")
    if (!result||!result.popup_data) return null;
    return result.popup_data;
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

async function loadSignals(){
        let rebuild=false;
        //loading data & normalization
        const result=await chrome.storage.session.get("AISOLOTL");
        let AISOLOTL=result?.AISOLOTL?? {};
        if (!AISOLOTL.signals) { //if signals doesn't exist
            AISOLOTL.signals={init_signal:"none",conv_signal:"none",sum_signal:"none",scroll_amt_signal:"none"};
            rebuild=true;
        }
        if (!AISOLOTL.signals.init_signal){
            AISOLOTL.signals={...AISOLOTL.signals,...{init_signal:"none"}}
            rebuild=true
        }
        if (!AISOLOTL.signals.conv_signal){
            AISOLOTL.signals={...AISOLOTL.signals,...{conv_signal:"none"}} 
            rebuild=true;
        } 
        if (!AISOLOTL.signals.sum_signal){
            AISOLOTL.signals={...AISOLOTL.signals,...{sum_signal:"none"}} //maybe optional
            rebuild=true;
        }
        if (!AISOLOTL.signals.scroll_amt_signal){
            AISOLOTL.signals={...AISOLOTL.signals,...{scroll_amt_signal:"none"}} 
            rebuild=true;
        } 

        if (rebuild) await chrome.storage.session.set({AISOLOTL:AISOLOTL});
}

async function loadState(){
    const result=await chrome.storage.session.get("AISOLOTL");
    if (!result||!result.AISOLOTL||!result.AISOLOTL.platform||!result.AISOLOTL.platform["Messenger"]||!result.AISOLOTL.platform["Messenger"].process_state) return "idle";
    return result.AISOLOTL.platform["Messenger"].process_state;
}

async function loadAmt(){
    const result=await chrome.storage.session.get("AISOLOTL");
    if (!result||!result.AISOLOTL||!result.AISOLOTL.platform||!result.AISOLOTL.platform["Messenger"]||!result.AISOLOTL.platform["Messenger"].scroll_amt) return 7;
    return result.AISOLOTL.platform["Messenger"].scroll_amt;
}

async function loadSaving_convo(){
    const result=await chrome.storage.session.get("saving_convo");
    return result.saving_convo ?? false;
}
