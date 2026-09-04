
document.addEventListener("DOMContentLoaded", async function(){
    let sum_btn=document.querySelector("#sum_btn");
    let conv_pick=document.querySelector("#conv_pick");
    let scroll_amt_input=document.querySelector("#scroll_amt");

    let c_list_container=[...await waitForElementsSettle2()]?.[2];
    let c_list;
    let c_list_labelled; //only label ones user picked
    let conv_picked={}

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

    async function initialize_conversations(){
        let cand=c_list_container.querySelectorAll("a[role='link'][aria-current][href]");
        let c_list=[...cand]; //prototype limitation
        return c_list;
    }

    async function createLabelledList(c_list){
        let c_list_labelled;
        let chatRegion= await waitForElement("div[role='log']");
        let conversation=chatRegion.getAttribute("aria-label");
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
                else c_list_labelled[c_identifier]={link:c_link,processed:false,current:true,checkboxAdded:false};
            }
            else {
                if (c_list_labelled[c_identifier]) c_list_labelled[c_identifier].current=false; //do not touch processed status for now
                else c_list_labelled[c_identifier]={link:c_link,processed:false,current:false,checkboxAdded:false};
            }
            return c_list_labelled;
        }
    }
})