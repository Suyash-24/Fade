import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from '@discordjs/builders';

try {
    const s1 = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Title"))
        .toJSON();
    console.log("S1 ok");
    
    const s2 = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7"))
        .toJSON();
    console.log("S2 ok");

    const s3 = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**All Time**\n> Messages Sent — 123\n> Server Rank — #1\n> Server Share — 100.0%")
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL("https://cdn.discordapp.com/avatars/123/123.png"))
        .toJSON();
    console.log("S3 ok");
} catch (e) {
    console.error(e);
}
