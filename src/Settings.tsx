import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormSection, FormSwitchRow } = Forms;

export default function Settings() {
    // You can add storage logic later using @vendetta/storage
    const [enabled, setEnabled] = React.useState(true);

    return (
        <FormSection title="Quiet Delete Settings">
            <FormSwitchRow
                label="Enable Quiet Delete"
                subLabel="Bypass message loggers by using nonce replacement."
                value={enabled}
                onValueChange={(val) => {
                    setEnabled(val);
                    // Note: To fully disable, you'd check this state before executing the function
                }}
            />
        </FormSection>
    );
}
