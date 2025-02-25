import Phaser from 'phaser';

export default class GroupUtils {
    // Filled group with items to avoid lag spikes in case of many instantiation of items in the same frame
    static populate(initialQuantity: number, group: Phaser.GameObjects.Group) {
        if (group.getLength() >= initialQuantity) {
            return;
        }

        const canBeDisabled: boolean = group.classType && typeof group.classType.prototype.disable === 'function';
        for (let i: number = 0; i < initialQuantity; i++) {
            const child: any = group.create();
            if (canBeDisabled)
            {
                child.disable();
            }
        }
    }
}