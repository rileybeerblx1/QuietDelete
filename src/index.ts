import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { React } from "@vendetta/metro/common";
import Settings from "./Settings";

const MessageActions = findByProps("sendMessage", "deleteMessage");
const UserStore = findByProps("getCurrentUser");
const NonceGenerator = findByProps("generateNonce");
const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

let patches = [];

async function executeQuietDelete(message: any) {
    try {
        // 1. Generate a new nonce
        const nonce = NonceGenerator.generateNonce();

        // 2. Send an invisible message with the same nonce
        const invisibleMsg = await MessageActions.sendMessage(message.channel_id, {
            content: "\u200b", // Zero-width space
            nonce: nonce,
            tts: false
        });

        // 3. Delete the original message
        await MessageActions.deleteMessage(message.channel_id, message.id);

        // 4. Delete the invisible replacement
        setTimeout(() => {
            MessageActions.deleteMessage(message.channel_id, invisibleMsg.id).catch(() => {});
        }, 100);

        showToast("Message Quietly Deleted", getAssetIDByName("ic_message_delete"));
    } catch (e) {
        console.error(e);
        showToast("Quiet Delete Failed", getAssetIDByName("ic_warning"));
    }
}

export default {
    onLoad() {
        // Patch the ActionSheet
        patches.push(after("openLazy", LazyActionSheet, (args, res) => {
            const [component, key, props] = args;
            
            if (key === "MessageLongPressActionSheet") {
                const message = props?.message;
                if (!message || message.author.id !== UserStore.getCurrentUser()?.id) return;

                // Patch the React Component returned by the ActionSheet
                const originalRender = res.type;
                res.type = function PatchedActionSheet(...props) {
                    const rendered = originalRender(...props);
                    
                    if (!rendered || !rendered.props || !rendered.props.children) return rendered;

                    // Create the custom button row
                    const quietDeleteButton = React.createElement(
                        require("@vendetta/ui/components").Forms.FormRow || "View", // Fallback if FormRow fails
                        {
                            label: "Quiet Delete (Anti-Logger)",
                            icon: getAssetIDByName("ic_message_delete"),
                            onPress: () => {
                                LazyActionSheet.hideActionSheet();
                                executeQuietDelete(message);
                            }
                        }
                    );

                    // Inject it into the children array
                    const children = Array.isArray(rendered.props.children) 
                        ? rendered.props.children 
                        : [rendered.props.children];

                    // Put it right before the normal "Delete Message" button
                    children.splice(children.length - 1, 0, quietDeleteButton);

                    // Return the new element with our button added
                    return React.cloneElement(rendered, { children });
                };
            }
        }));
    },
    
    onUnload() {
        patches.forEach((unpatch) => unpatch());
        patches = [];
    },
    
    settings: Settings,
};
