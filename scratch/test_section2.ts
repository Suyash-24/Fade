import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, ButtonBuilder, ButtonStyle } from '@discordjs/builders';

try {
    const txt = new TextDisplayBuilder().setContent("Hello World");
    const thumb = new ThumbnailBuilder().setURL("https://example.com/thumb.png");
    const btn = new ButtonBuilder().setCustomId("123").setStyle(ButtonStyle.Secondary);

    console.log("Creating s1 with button...");
    const s1 = new SectionBuilder().addTextDisplayComponents(txt).setAccessory(btn).toJSON();
    console.log("S1 ok");
} catch (e) {
    console.error("S1 fail:", e.message);
}

try {
    const txt = new TextDisplayBuilder().setContent("Hello World");
    const thumb = new ThumbnailBuilder().setURL("https://example.com/thumb.png");

    console.log("Creating s2 with no accessory...");
    const s2 = new SectionBuilder().addTextDisplayComponents(txt).toJSON();
    console.log("S2 ok");
} catch (e) {
    console.error("S2 fail:", e.message);
}
