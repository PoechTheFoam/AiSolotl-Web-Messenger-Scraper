
document.addEventListener("DOMContentLoaded", async function(){
    let sum_btn=document.querySelector("#sum_btn");
    let conv_picker=document.querySelector("#conv_pick");
    let scroll_amt_input=document.querySelector("#scroll_amt");
    let init_btn=document.querySelector("#init_btn");
    let indicator=document.querySelector("#indicator");
    let loading_text=indicator.querySelector("[class='loading_text']");
    let original_text=loading_text.innerText;
    let signals=await loadSignals(); //=AISOLOTL.signals


    let conv_picked={}
    let c_list;
    let c_list_labelled;

    chrome.storage.onChanged.addListener((changes,areaName)=>{
    if (areaName==="local"){
        for (const [key, {oldValue, newValue}] of Object.entries(changes)){
            if (key==="AISOLOTL"){ //AISOLOTL, key=signals.
                const result=newValue.signals; //there is no new value? (no changes?)
                if (!result) return;
                else {
                    signals={init_signal:result?.init_signal?? "none", conv_signal: result?.conv_signal?? "none", scroll_amt_signal:result?.scroll_amt_signal?? "none",sum_signal:result?.sum_signal?? "none"}
                }
                refreshInit_btn();
                refreshConv_picker();
                //refresh for scroll_amt may not be necessary.
                refreshSum_btn();
                
                
            }
        }
    }
    })





    init_btn.addEventListener("click",async ()=>{
        
        loading_text.textContent="Extracting data, please refrain from clicking on anything"
        indicator.style.display="flex";
        try {
            const [tab]= await chrome.tabs.query({active:true,currentWindow:true});
            if (!tab) {
                console.error("No active tabs to gather data from, please switch your current tab to Messenger and try again.");
                return;
            }

            let new_signals={init_signal:"initializing"};
            signals={...signals,...new_signals};
            await chrome.storage.local.set({signals:signals});

        } catch(error) {
            loading_text.textContent="Failed to extract messages, please try again."
            console.error("Error sending message: ",error)
        }
        
    })

    sum_btn.addEventListener("click", async ()=>{
        try{
            const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
            if (!tab){
                console.error("No active tabs to gather data from, please switch your current tab to Messenger and try again.");
                return;
            }
            const response=chrome.tabs.sendMessage(tab.id,{})
        }
        catch(error){
            loading_text.textContent="Failed to summarize messages, please try again."
            console.error("Error sending message: ",error)
        }
    })

    conv_picker.addEventListener("click", async ()=>{
        
        try{
            const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
            if (!tab){
                console.error("No active tabs to gather data from, please switch your current tab to Messenger and try again.");
                return;
            }
            const response=await chrome.tabs.sendMessage(tab.id,{signal:"pick_conv"});
        }
        catch(error){
            loading_text.textContent="Failed to add checkboxes, please try again."
            console.error(error);
        }
    })

    scroll_amt_input.addEventListener("input", async (event)=>{
        let scroll_amt=event.target.valueAsNumber;
        try{
            const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
            if (!tab){
                console.error("No active tabs to gather data from, please switch your current tab to Messenger and try again.");
                return;
            }
            const response=await chrome.tabs.sendMessage(tab.id,{signal:"input_scroll_amt"});
        }
        catch (error){
            loading_text.textContent="Failed to parse/receive scroll amount, please try again."
            console.error(error);
        }
    })

    async function loadSignals(){
        let output;
        let rebuild=false;
        //loading data & normalization
        const result=await chrome.storage.local.get("AISOLOTL");
        let AISOLOTL=result?.AISOLOTL?? {};
        if (!AISOLOTL.signals) { //if signals doesn't exist
            AISOLOTL.signals={init_signal:"none",conv_signal:"none",sum_signal:"none",scroll_amt_signal:"none"};
            rebuild=true;
        }
        if (!AISOLOTL.signals.init_signal){
            AISOLOTL.signals.init_signal={...AISOLOTL.signals,...{init_signal:"none"}}
            rebuild=true
        }
        if (!AISOLOTL.signals.conv_signal){
            AISOLOTL.signals.conv_signal={...AISOLOTL.signals,...{conv_signal:"none"}} 
            rebuild=true;
        } 
        if (!AISOLOTL.signals.sum_signal){
            AISOLOTL.signals.sum_signal={...AISOLOTL.signals,...{sum_signal:"none"}} //maybe optional
            rebuild=true;
        }
        if (!AISOLOTL.signals.scroll_amt_signal){
            AISOLOTL.signals.scroll_amt_signal={...AISOLOTL.signals,...{scroll_amt_signal:"none"}} 
            rebuild=true;
        } 

        if (rebuild) await chrome.storage.local.set({AISOLOTL:AISOLOTL});
        return AISOLOTL.signals;
    }

    function refreshInit_btn(){
    if (signals.init_signal==="none") init_btn.disabled=false; // uncertain when this happens, and if this solution is correct

    if (signals.init_signal==="initializing"){ //when to switc this boolean off?
            init_btn.disabled=true;
            loading_text.textContent="Extracting data, please refrain from clicking on anything"
            indicator.style.display="flex";
        }
    if (signals.init_signal==="finished"){
            init_btn.disabled=false;
            conv_picker.disabled=false;
            scroll_amt_input.disabled=false;
            indicator.style.display="none";
            loading_text.textContent=original_text;
        }
}
    function refreshConv_picker(){
        // no case handling for conv_signal=none

        if (signals.conv_signal==="initializing"){
            conv_picker.disabled=true;
            loading_text.textContent="Adding checkboxes, please refrain from clicking on anything"
            indicator.style.display="flex";
        }
        if (signals.conv_signal==="finished"){
            conv_picker.disabled=false;
            indicator.style.display="none";
            loading_text.textContent=original_text;
        }
        // Implement conversations saving/memorization features when/where?
    }

    function refreshScroll_amt_input(){
        /*if (signals.scroll_amt_input_signal==="initializing"){
            scroll_amt_input.disabled=true;
            loading_text.textContent="Adding checkboxes, please refrain from clicking on anything"
            indicator.style.display="flex";
        }
        if (signals.scroll_amt_input_signal==="finished"){
            conv_picker.disabled=false;
            indicator.style.display="none";
            loading_text.textContent=original_text;
        }*/
       // Maybe unnecessary for now
    }

    function refreshSum_btn(){
        if (signals.sum_signal==="initializing"){
            sum_btn.disabled=true;
            loading_text.textContent="Adding checkboxes, please refrain from clicking on anything"
            indicator.style.display="flex";
        }
        if (signals.sum_signal==="finished" && signals.init_signal==="finished"){
            sum_btn.disabled=false;
            indicator.style.display="none";
            loading_text.textContent=original_text;
        }
    }

    async function saveSignals(signals){
        const result=await chrome.storage.local.get("AISOLOTL");
        let AISOLOTL=result?.AISOLOTL?? {};
        AISOLOTL={...AISOLOTL,
            signals:(AISOLOTL.signals?? {}),...signals};

        await chrome.storage.local.set({AISOLOTL:AISOLOTL});
    }
    
});