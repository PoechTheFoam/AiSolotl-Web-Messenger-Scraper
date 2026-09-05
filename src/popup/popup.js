
document.addEventListener("DOMContentLoaded", async function(){
    let sum_btn=document.querySelector("#sum_btn");
    let conv_pick=document.querySelector("#conv_pick");
    let scroll_amt_input=document.querySelector("#scroll_amt");
    let init_btn=document.querySelector("#init_btn");

    let conv_picked={}

    init_btn.addEventListener("click",async ()=>{
        try {
            const [tab]= await chrome.tabs.query({active:true,currentWindow:true});
            if (!tab) console.error("No active tabs to gather data from, please switch your current tab to Messenger and try again.")//implement missing logic case right now
            const response=await chrome.tabs.sendMessage(tab.id,{signal:"start_init"})
            
        } catch(error) {
            console.error("Error sending message: ",error)
        }
        
    })

    sum_btn.addEventListener("click", async ()=>{

    })

    conv_pick.addEventListener("click", async ()=>{
        c_list=initialize_conversations();
        const observer=new MutationObserver(((mutations, obs)=>{
            c_list=initialize_conversations();
        }))
        observer.observe(c_list_container,{
            subtree:true
        })
    })

    scroll_amt_input.addEventListener("change", ()=>{

    })



    async function updateUI(){
        c_list=initialize_conversations();
        c_list_labelled={...c_list_labelled,...createLabelledList(c_list)};
        addCheckboxes(c_list_labelled);
    }

    async function addCheckboxes(c_list_labelled){
        for (const [key, value] of c_list_labelled){
            if (!value.checkboxAdded){
                let checkbox=document.createElement("input")
                checkbox.type="checkbox";
                checkbox.id=key;
                let c=document.querySelector()
            }
        }
    }
});