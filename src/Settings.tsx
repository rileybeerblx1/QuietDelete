import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { React } from "@vendetta/metro/common";
import Settings from "./Settings";

// Discord Modules
const MessageActions = findByProps("sendMessage", "deleteMessage");
const UserStore = findByProps("getCurrentUser");
const NonceGenerator = findByProps("generateNonce");
const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

let patches = [];

async function executeQuietDelete(message: any) {
    try {
        // 1. Generate a new nonce
        const nonce = NonceGenerator.generateNonce();

        // 2. Send an invisible message with the same nonce. 
        // Discord client uses nonces to replace existing messages locally.
        const invisibleMsg = await MessageActions.sendMessage(message.channel_id, {
            content: "\u200b", // Zero-width space to bypass blank-message filters
            nonce: nonce,
            tts: false
        });

        // 3. Immediately delete the original message
        await MessageActions.deleteMessage(message.channel_id, message.id);

        // 4. Delete the invisible replacement message slightly after
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
        // Patch the ActionSheet that appears when you long-press a message
        patches.push(after("openLazy", LazyActionSheet, (args, res) => {
            const [component, key, props] = args;
            
            if (key === "MessageLongPressActionSheet") {
                const message = props?.message;
                
                // Only show the button for your own messages
                if (!message || message.author.id !== UserStore.getCurrentUser()?.id) return;

                // Intercept the React element to inject our custom button
                if (res && res.props && res.props.children) {
                    const originalChildren = res.props.children;
                    
                    // We wrap the original children to add our button at the top
                    res.props.children = (parentProps) => {
                        const original = originalChildren(parentProps);
                        
                        const quietDeleteButton = React.createElement(React.Fragment, null, {
                            label: "Quiet Delete (Anti-Logger)",
                            icon: getAssetIDByName("ic_message_delete"),
                            action: () => executeQuietDelete(message)
                        });

                        if (original && original.props && original.props.children) {
                            if (Array.isArray(original.props.children)) {
                                original.props.children.unshift(quietDeleteButton);
                            } else {
                                original.props.children = [quietDeleteButton, original.props.children];
                            }
                        }
                        return original;
                    };
                }
            }
        }));
    },
    
    onUnload() {
        patches.forEach((unpatch) => unpatch());
        patches = [];
    },
    
    settings: Settings,
};
