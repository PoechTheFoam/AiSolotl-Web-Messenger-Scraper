
document.addEventListener("DOMContentLoaded", async function(){
    let sum_btn=document.querySelector("#sum_btn");
    let conv_picker=document.querySelector("#conv_pick");
    let scroll_amt_input=document.querySelector("#scroll_amt");
    let clear_btn=document.querySelector("#clear_btn");
    let indicator=document.querySelector("#indicator");
    let loading_text=indicator.querySelector("[class='loading_text']");
    let original_text=loading_text.innerText;
    let signals=await loadSignals();
    refreshUI();

    chrome.storage.onChanged.addListener((changes,areaName)=>{
    if (areaName==="session"){
        for (const [key, {oldValue, newValue}] of Object.entries(changes)){
            if (key==="AISOLOTL"){ //AISOLOTL, key=signals.
                const result=newValue?.signals?? {}; //there is no new value? (no changes?)
                signals={init_signal:result?.init_signal?? "none", conv_signal: result?.conv_signal?? "none", scroll_amt_signal:result?.scroll_amt_signal?? "none",sum_signal:result?.sum_signal?? "none"}
                refreshUI();
            }
        }
    }
    })
   
    clear_btn.addEventListener("click",async()=>{
        try{
            const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
            if (!tab){
                console.error("No active tabs to gather data from, please switch your current tab to Messenger and try again.");
                return;
            }

            const response=await chrome.tabs.sendMessage(tab.id,{signal:"clear"});
        }
        catch(error){
            loading_text.textContent="Failed to summarize messages, please try again."
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

            await saveSignals({sum_signal:"initializing"});

            const response=await chrome.tabs.sendMessage(tab.id,{signal:"sum_start"})
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

            await saveSignals({conv_signal:"initializing"});

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

            await saveSignals({scroll_amt_signal:"initializing"});

            const response=await chrome.tabs.sendMessage(tab.id,{signal:"input_scroll_amt",scroll_amt:scroll_amt});
        }
        catch (error){
            loading_text.textContent="Failed to parse/receive scroll amount, please try again."
            console.error(error);
        }
    })

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
        return AISOLOTL.signals;
    }

    function refreshUI(){
        const init_finished=signals.init_signal==="finished";
        const conv_initializing=signals.conv_signal==="initializing";
        const conv_finished=signals.conv_signal==="finished";
        const scroll_amt_initializing=scroll_amt_input==="initializing";
        const scroll_amt_finished=scroll_amt_input==="finished";
        const sum_initializing=signals.sum_signal==="initializing";
        const sum_finished=signals.sum_signal==="finished";
        //pre-initialization
        if (!init_finished){
            conv_picker.disabled=true;
            scroll_amt_input.disabled=true;
            loading_text.textContent="Extracting data, please refrain from clicking on anything"
            indicator.style.display="flex";
            return; //remove if things goes wrong later
        }
        if (init_finished&&!conv_initializing&&!scroll_amt_initializing) {
            conv_picker.disabled=false;
            scroll_amt_input.disabled=false;
            indicator.style.display="none";
            loading_text.textContent=original_text;
            return; //remove if things goes wrong later
        }
        
        //conv_picker
        if (conv_initializing){
            conv_picker.disabled=true;
            loading_text.textContent="Adding checkboxes, please refrain from clicking on anything"
            indicator.style.display="flex";
        }
        if (conv_finished){
            conv_picker.disabled=false;
            indicator.style.display="none";
            loading_text.textContent=original_text;
        }

        //scroll_amt_input

        //sum_btn
        if (sum_initializing){
            sum_btn.disabled=true;
            loading_text.textContent="Summarizing, please refrain from clicking on anything"
            indicator.style.display="flex";
        }
        if (((sum_finished) && (init_finished&& conv_finished && scroll_amt_finished))||(!sum_initializing)&&(init_finished&& conv_finished && scroll_amt_finished)){
            sum_btn.disabled=false;
            indicator.style.display="none";
            loading_text.textContent=original_text;
        }
        
    }

    async function saveSignals(signals_saved){ // signals are different to signals sent in chrome.sendMessage
        const result=await chrome.storage.session.get("AISOLOTL");
        let AISOLOTL=result?.AISOLOTL?? {};
        let signals=AISOLOTL?.signals?? {};
        AISOLOTL={...AISOLOTL,
            signals:{...signals,...signals_saved}}
        await chrome.storage.session.set({AISOLOTL});
        };
    }
);