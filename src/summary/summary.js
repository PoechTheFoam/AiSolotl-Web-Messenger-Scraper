document.addEventListener("DOMContentLoaded", async function(){
    let initializing_section=document.querySelector("#initializing");
    let finished_section=document.querySelector("#finished")
    let error_section=document.querySelector("#error")
    let overall_summary_block=document.querySelector("#overall_summary")
    let emergency_block=document.querySelector("#emergency")
    let urgent_block=document.querySelector("#urgent")
    let less_urgent_block=document.querySelector("#less_urgent")
    let casual_block=document.querySelector("#casual")
    let popup_state=await loadPopup_state();
    let popup_data=await loadPopup_data();
    let building=false;
    if (!building&&(popup_state!=="idle")){
        building=true
        renderPopup(popup_state,popup_data)
        building=false;
    }
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName!=="session") return;

        if (changes.popup_state||changes.popup_data){
            const popup_state=await loadPopup_state();
            const popup_data=await loadPopup_data();
            if (building) return;
            else{
                building=true;
                renderPopup(popup_state,popup_data);
                building=false;
            }
        }
    });

    async function savePopup_state(popup_state_saved){
        const result=await chrome.storage.session.get("popup_state")
        await chrome.storage.session.set({popup_state:popup_state_saved});
        
    }

    async function savePopup_data(popup_data_saved){
        const result=await chrome.storage.session.get("popup_data")
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
    
    function renderPopup(popup_state,popup_data){

        if (popup_state==="initializing"){
            initializing_section.style.display=""
            finished_section.style.display="none"
            error_section.style.display="none"
            return;
        }
        if (popup_state==="finished"){
            if (!popup_data?.result){
                console.error("Finished popup has no summary data");
                return;
            }
            overall_summary_block.replaceChildren();
            emergency_block.replaceChildren();
            urgent_block.replaceChildren();
            less_urgent_block.replaceChildren();
            casual_block.replaceChildren();
            let summary=popup_data.result
            let overall_summary=summary.summary;
            let emergency=summary.emergency;
            let urgent=summary.urgent;
            let less_urgent=summary.less_urgent;
            let casual= summary.casual;
            initializing_section.style.display="none"
            error_section.style.display="none"
            for (const text of overall_summary){
                const p=document.createElement("p")
                p.textContent=text
                overall_summary_block.appendChild(p);
            }
            renderItems(emergency_block,emergency);
            renderItems(urgent_block,urgent);
            renderItems(less_urgent_block,less_urgent);
            renderItems(casual_block,casual);
            finished_section.style.display=""
            return
        }
        if (popup_state==="error"){
            initializing_section.style.display="none"
            finished_section.style.display="none"
            error_section.style.display=""
            return
        }
    }

    function renderItems(container, items){
        if (items.length===0){
            return;
        }
        for (const item of items) {
            const card = document.createElement("div");
            card.classList.add("summary-card");

            const conversation = document.createElement("h4");
            conversation.textContent = item.conversation;

            const summary = document.createElement("p");
            summary.textContent = item.summary;

            card.appendChild(conversation);
            card.appendChild(summary);

            if (item.deadline) {
                const deadline = document.createElement("p");
                deadline.textContent = `Deadline: ${item.deadline}`;
                card.appendChild(deadline);
            }

            if (item.action) {
                const action = document.createElement("p");
                action.textContent = `Action: ${item.action}`;
                card.appendChild(action);
            }

            container.appendChild(card);
        }
    }
})