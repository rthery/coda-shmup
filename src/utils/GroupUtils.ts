import Phaser from 'phaser';

export default class GroupUtils {
    // Filled group with items to avoid lag spikes in case of many instantiation of items in the same frame
    static populate(initialQuantity: number, group: Phaser.GameObjects.Group) {
        if (group.getLength() >= initialQuantity) {
            return;
        }

        for (let i = 0; i < initialQuantity; i++) {
            group.get();
        }

        // We disable them all immediately
        if (group.classType && typeof group.classType.prototype.disable === 'function') {
            group.children.each((item: Phaser.GameObjects.GameObject) => {
                (item as any).disable();
                return true;
            });
        }
    }
}