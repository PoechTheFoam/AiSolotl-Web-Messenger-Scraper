
document.addEventListener("DOMContentLoaded", async function(){
    let sum_btn=document.querySelector("#sum_btn");
    let conv_pick=document.querySelector("#conv_pick");
    let scroll_amt_input=document.querySelector("#scroll_amt");
    let init_btn=document.querySelector("#init_btn");
    let indicator=document.querySelector("#indicator");
    let loading_text=indicator.querySelector("[class='loading_text']");

    let conv_picked={}
    let c_list;
    let c_list_labelled;

    init_btn.addEventListener("click",async ()=>{
        let original_text=loading_text.innerText;
        loading_text.textContent="Extracting data, please refrain from clicking on anything"
        indicator.style.display="flex";
        try {
            const [tab]= await chrome.tabs.query({active:true,currentWindow:true});
            if (!tab) {
                console.error("No active tabs to gather data from, please switch your current tab to Messenger and try again.");
                return;
            }//implement missing logic case right now
            const response=await chrome.tabs.sendMessage(tab.id,{signal:"start_init"})
            if (response.status==="finished"){
                c_list_labelled=response.c_list_labelled;
                c_list=response.c_list;
                conv_pick.disabled=false;
                scroll_amt_input.disabled=false;
            }
            indicator.style.display="none";
            loading_text.textContent=original_text;
        } catch(error) {
            console.error("Error sending message: ",error)
        }
        
    })

    sum_btn.addEventListener("click", async ()=>{

    })

    conv_pick.addEventListener("click", async ()=>{
        addCheckboxes(c_list_labelled);
    })

    scroll_amt_input.addEventListener("change", ()=>{

    })



    async function updateUI(){
        addCheckboxes(c_list);
    }

    function addCheckboxes(c_list){
        for (const c of c_list){
            let checkbox=document.createElement("input");
            checkbox.type="checkbox";
            checkbox.id=key;
            c.insertAdjacentElement("beforebegin",checkbox);
        }
    }
});