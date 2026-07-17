import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from '@discordjs/builders';

try {
    const s1 = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("With accessory"))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL("https://example.com/thumb.png"))
        .toJSON();
    console.log("S1 ok (with accessory)");
    
    const s2 = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Without accessory"))
        .toJSON();
    console.log("S2 ok (no accessory)");
} catch (e) {
    console.error("Test failed:", e.message);
}
