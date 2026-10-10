// This screen lays out the town's hanging facility signs. A tap navigates after the sign
// feedback; a hold explains the destination. The current town determines where we return.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { bindSelectionDetails, addDetailsHint } from '../ui/SelectionDetails.js';
import { pois } from '../data/worldMap.js';

const TOWN_DESTINATIONS = [
  {
    title: "ADVENTURER'S HALL", label: "ADVENTURER'S\nHALL",
    description: 'Assign gear and items to characters, and learn battle tactics!',
    target: 'AdventurersHallScene', art: 'town-sign-hall', icon: 'hall', tint: 0xb9d3dc,
    artWidth: 390, artHeight: 390, artTop: -10, chainCrop: 235, anchorOffset: 90
  },

  {
    title: 'ALCHEMIST', label: 'ALCHEMIST',
    description: 'Buy, sell, and brew potions!',
    target: 'Alchemist', art: 'town-sign-alchemist', icon: 'alchemist', tint: 0xbdd3a0,
    artWidth: 390, artHeight: 325, artTop: -10, chainCrop: 235, anchorOffset: 90
  },

  {
    title: 'BLACKSMITH', label: 'BLACKSMITH',
    description: 'Craft gear for your characters and sell gathered materials.',
    target: 'BlacksmithScene', art: 'town-sign-blacksmith', icon: 'blacksmith', tint: 0xe9b777,
    artWidth: 390, artHeight: 310, artTop: -10, chainCrop: 145, anchorOffset: 95
  },

  {
    title: 'ENCHANTER', label: 'ENCHANTER',
    description: 'Explore arcane lore and learn where to use Arcane Essence in this demo.',
    target: 'Enchanter', art: 'town-sign-enchanter', icon: 'enchanter', tint: 0xc9b5df,
    artWidth: 390, artHeight: 325, artTop: -10, chainCrop: 210, anchorOffset: 108
  }
];

// Draw the matching town facility symbol in the sign's local coordinates.
function addSignIcon(scene, kind, color) {
  const icon = scene.add.graphics();
  icon.lineStyle(3, color, 0.96);
  icon.setPosition(0, 122);
  icon.beginPath();

  if (kind === 'hall') {
    icon.moveTo(0, -26);
    icon.lineTo(22, -18);
    icon.lineTo(20, 8);
    icon.lineTo(0, 27);
    icon.lineTo(-20, 8);
    icon.lineTo(-22, -18);
    icon.closePath();
    icon.strokePath();
    icon.lineBetween(-13, 13, 13, -13);
    icon.lineBetween(-13, -13, 13, 13);
  } else if (kind === 'alchemist') {
    icon.moveTo(-10, -27);
    icon.lineTo(10, -27);
    icon.moveTo(-6, -27);
    icon.lineTo(-6, -9);
    icon.lineTo(-20, 18);
    icon.lineTo(-17, 24);
    icon.lineTo(17, 24);
    icon.lineTo(20, 18);
    icon.lineTo(6, -9);
    icon.lineTo(6, -27);
    icon.strokePath();
    icon.lineBetween(-15, 9, 15, 9);
  } else if (kind === 'blacksmith') {
    icon.moveTo(-25, -3);
    icon.lineTo(24, -3);
    icon.lineTo(14, 10);
    icon.lineTo(4, 10);
    icon.lineTo(4, 22);
    icon.lineTo(-14, 22);
    icon.lineTo(-14, 10);
    icon.lineTo(-25, 5);
    icon.closePath();
    icon.strokePath();
    icon.lineBetween(-17, -11, 12, -11);
  } else {
    icon.moveTo(0, -27);
    icon.lineTo(8, -8);
    icon.lineTo(26, 0);
    icon.lineTo(8, 8);
    icon.lineTo(0, 27);
    icon.lineTo(-8, 8);
    icon.lineTo(-26, 0);
    icon.lineTo(-8, -8);
    icon.closePath();
    icon.strokePath();
    icon.strokeCircle(0, 0, 6);
  }

  return icon;
}

export default class TownScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() {
    super('TownScene');
  }

  // Read the data supplied when this scene starts before creating its screen contents.
  init(data) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const town = pois.find((poi) => poi.id === (data?.townId ?? GameState.world.currentLocation) && poi.type === 'town');

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.townName = data?.townName ?? town?.name ?? 'Pineshire';

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.townArt = town?.id === 'pineshire' ? 'town' : town?.conceptArt ?? 'town';
  }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    this.openingDestination = false;
    this.cameras.main.setBackgroundColor('#1c1917');
    const background = this.add.image(width / 2, height / 2, this.townArt);

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    background.setScale(Math.max(width / background.width, height / background.height));
    this.add.rectangle(width / 2, height / 2, width, height, 0x100e0c, 0.24);

    this.add.rectangle(width / 2, UI_SAFE_TOP + 115, 1800, 138, 0x17120f, 0.72);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.add.text(width / 2, UI_SAFE_TOP + 90, this.townName.toUpperCase(), {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('display72'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
      stroke: '#21150c', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 145, 'Rest, prepare, and decide who is going underground next.', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: '#e3d4bd'
    }).setOrigin(0.5);

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const signCenters = [-700, -300, 300, 700].map((offset) => width / 2 + offset);
    TOWN_DESTINATIONS.forEach((choice, index) => this.createSign(choice, signCenters[index], index));

    // flatMap builds callback results and flattens one array level. Returning [] removes
    // an entry; returning [value] keeps one result.
    const beamAnchors = signCenters.flatMap((x, index) => [
      x - TOWN_DESTINATIONS[index].anchorOffset, x + TOWN_DESTINATIONS[index].anchorOffset
    ]);
    beamAnchors.push(width / 2 - 75, width / 2 + 75);
    this.createHangingBeam(beamAnchors, UI_SAFE_TOP + 260, 1850);
    this.createRegionMapSign(width / 2);
    addDetailsHint(this, height - 38, 'Long press a sign for details.');
  }

  // Draw the town beam that visually supports the facility signs.
  createHangingBeam(anchors, y, span) {
    const textureKey = 'town-sign-beam';
    if (!this.textures.exists(textureKey)) {
      const source = this.textures.get('town-sign-world-map').getSourceImage();
      const canvas = document.createElement('canvas');
      canvas.width = span;
      canvas.height = 34;

      // drawImage copies a source rectangle into a destination rectangle. After the image,
      // the first four numbers choose the artwork crop; the last four choose its position
      // and size on this canvas.
      canvas.getContext('2d').drawImage(source, 180, 310, 1720, 112, 0, 0, span, 34);
      this.textures.addCanvas(textureKey, canvas);
    }

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    this.add.image(this.scale.width / 2, y + 16, textureKey).setDisplaySize(span, 34).setDepth(4);
    const beam = this.add.graphics().setDepth(4);
    const left = this.scale.width / 2 - span / 2;
    beam.lineStyle(3, 0xb48a51, 0.9);
    beam.strokeRoundedRect(left, y, span, 32, 6);
    beam.lineStyle(2, 0x251b18, 0.82);
    beam.lineBetween(left + 8, y + 30, left + span - 8, y + 30);

    anchors.forEach((x) => {
      beam.fillStyle(0x18191a);
      beam.fillCircle(x, y + 17, 9);
      beam.lineStyle(2, 0x5d6060);
      beam.strokeCircle(x, y + 17, 9);
      beam.fillStyle(0x37393a);
      beam.fillCircle(x, y + 17, 4);
    });
  }

  // Place a hanging facility sign and connect valid tap navigation plus held details.
  createSign(choice, x, index) {

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const sign = this.add.container(x, UI_SAFE_TOP + 267).setDepth(3);
    const art = this.add.image(0, choice.artTop + choice.artHeight / 2, choice.art)
      .setDisplaySize(choice.artWidth, choice.artHeight);
    const source = this.textures.get(choice.art).getSourceImage();
    art.setCrop(0, choice.chainCrop, source.width, source.height - choice.chainCrop);
    const attachmentY = choice.artTop + choice.artHeight * choice.chainCrop / source.height;
    const icon = addSignIcon(this, choice.icon, choice.tint);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. The condition before ? chooses the first value when true and the value after
    // : when false.
    const label = this.add.text(0, 190, choice.label, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: choice.icon === 'hall' ? fontPx('body34') : fontPx('heading40'),
      fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2', align: 'center',
      lineSpacing: -2, stroke: '#241b17', strokeThickness: 4
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 179, 380, 250, 0x000000, 0);
    sign.add([art, this.createAttachmentNails(choice.anchorOffset, attachmentY), icon, label, hit]);

    this.createHangingChains(sign, choice.anchorOffset, attachmentY);

    bindSelectionDetails(this, hit, { title: choice.title, description: choice.description },
      this.animateSign(sign, index, () => {
        if (['AdventurersHallScene', 'BlacksmithScene'].includes(choice.target)) this.scene.start(choice.target);
        else this.scene.start('FacilityScene', { title: choice.target, townName: this.townName });
      }));
  }

  // Build the lower World Map sign and its return action.
  createRegionMapSign(x) {

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const sign = this.add.container(x, UI_SAFE_TOP + 294).setDepth(3);
    const signCenterY = 406;
    const attachmentY = signCenterY - 83 + 166 * 190 / 756;
    const art = this.add.image(0, signCenterY, 'town-sign-world-map').setDisplaySize(490, 166);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    const label = this.add.text(0, signCenterY, 'WORLD MAP', {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading40'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
      stroke: '#241b17', strokeThickness: 4
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, signCenterY, 490, 130, 0x000000, 0);
    sign.add([art, this.createAttachmentNails(75, attachmentY), label, hit]);
    this.createHangingChains(sign, 75, attachmentY);

    bindSelectionDetails(this, hit, {
      title: 'WORLD MAP', description: 'Return to the world map to choose another town or delve.'
    }, this.animateSign(sign, 4, () => this.scene.start('TitleScene')));
  }

  // Draw the sign attachments at their supplied local positions.
  createAttachmentNails(offset, y) {
    const nails = this.add.graphics();
    [-offset, offset].forEach((x) => {
      nails.fillStyle(0x1a1b1c);
      nails.fillCircle(x, y, 10);
      nails.lineStyle(2, 0x666666);
      nails.strokeCircle(x, y, 10);
      nails.fillStyle(0x353738);
      nails.fillCircle(x, y, 4);
    });

    return nails;
  }

  // Draw the supporting chains in the sign container's coordinate space.
  createHangingChains(sign, offset, attachmentY) {

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const chains = this.add.graphics().setDepth(2);
    const topY = UI_SAFE_TOP + 294;
    const redraw = () => {
      chains.clear();
      const angle = Phaser.Math.DegToRad(sign.angle);
      [-offset, offset].forEach((localX) => {
        const topX = sign.x + localX;

        // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
        // gives the vertical part. Multiplying by a radius turns those fractions into
        // offsets.
        const endX = sign.x + localX * Math.cos(angle) - attachmentY * Math.sin(angle);
        const endY = sign.y + localX * Math.sin(angle) + attachmentY * Math.cos(angle);

        // Math.max chooses the largest value; pairing it with Math.min can keep a result
        // inside both a lower and an upper bound.
        const linkCount = Math.max(1, Math.round((endY - topY) / 15));
        for (let i = 0; i < linkCount; i++) {
          const t = (i + 0.5) / linkCount;

          // Linear blends from the first value to the second using the third argument: 0
          // gives the start, 1 gives the end, and 0.5 gives halfway.
          const x = Phaser.Math.Linear(topX, endX, t);
          const y = Phaser.Math.Linear(topY, endY, t);
          chains.lineStyle(4, 0x1b1b1a);
          chains.strokeEllipse(x, y, 11, 19);
          chains.lineStyle(1, 0x847c6c, 0.75);
          chains.strokeEllipse(x - 1, y - 1, 8, 16);
        }
      });
    };

    redraw();

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    this.events.on('update', redraw);

    // once registers a callback that removes itself after the first matching event.
    this.events.once('shutdown', () => this.events.off('update', redraw));
  }

  // Give the pressed sign its brief swinging feedback before completing navigation.
  animateSign(sign, index, onComplete) {

    // The condition before ? chooses the first value when true and the value after : when
    // false. % gives the remainder. With a nonnegative index and positive list length, it
    // wraps the index back to the start of the list.
    const restingAngle = index % 2 === 0 ? -1.1 : 1.1;
    sign.setAngle(restingAngle);
    const sway = this.tweens.add({
      targets: sign, angle: -restingAngle,
      duration: 2600 + index * 210,
      ease: 'Sine.inOut', yoyo: true, repeat: -1
    });

    return () => {
      if (this.openingDestination) return;
      this.openingDestination = true;
      HapticsService.tap();
      sway.stop();

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      this.tweens.add({
        targets: sign, angle: sign.angle < 0 ? 4 : -4, duration: 105,
        ease: 'Sine.inOut', yoyo: true, repeat: 1,
        onComplete
      });
    };
  }
}
