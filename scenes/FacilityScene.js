// This is the shared shop workspace. The selected facility supplies stock, theme and
// allowed actions. List scrolling changes row positions; clipping and input checks keep
// rows outside the visible window from receiving a tap.

import Phaser from 'phaser';
import { renderShopCatalog } from '../ui/ShopCatalog.js';
import { FACILITIES, renderFacilityMenu } from '../ui/FacilityMenu.js';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { playUiSound } from '../services/UiAudioService.js';
import { buyPotionPack, equipmentOwner, equipmentStatsText } from '../game/Equipment.js';
import { POTION_ITEMS, CRAFTING_RECIPES, getEquipmentDefinition } from '../data/items.js';

import { ACTIVE_ENCHANTMENTS, ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import HapticsService from '../services/HapticsService.js';
import { canCraft, craftItem, recipeIngredientText } from '../game/Crafting.js';
import { learnInventoryRecipes } from '../game/RecipeKnowledge.js';

import { GEAR_STOCK, saleRows, sellOwnedItem, sellAllOwnedItem, buyGear, inscribeEnchantment, applyEnchantment, disenchantItem } from '../game/ShopServices.js';

// Scroll cards state the exact bonus without expanding it into derived character stats.
const enchantmentText = definition => equipmentStatsText(definition.stats).replace(/\b(STR|AGI|INT|WIS|HP)\b/g,
  stat => ({ STR: 'Strength', AGI: 'Agility', INT: 'Intellect', WIS: 'Wisdom', HP: 'Health' })[stat]);

export default class FacilityScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor(key = 'FacilityScene') { super(key); }

  // Read the data supplied when this scene starts before creating its screen contents.
  init(data) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.facility = FACILITIES[data?.title] ?? FACILITIES.Alchemist;
    this.returnScene = data?.returnScene ?? 'TownScene';
    this.selection = this.facility.choices[0].id;
    this.selectedItemId = null;
    this.detailOffset = 0;
    this.leaving = false;
    this.category = 'all';
    this.itemOffset = 0;
    this.message = '';
    this.selectedScroll = null;
  }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {
    const back = () => {
      if (this.selectionDetailsClose) { playUiSound(this, 'dialogClose'); this.selectionDetailsClose(); }
      else this.returnToTown();
    };
    const resize = () => this.render();
    this.scale.on('resize', resize);
    this.input.keyboard?.on('keydown-ESC', back);
    this.events.once('shutdown', () => {
      this.scale.off('resize', resize);
      this.input.keyboard?.off('keydown-ESC', back);
      this.selectionDetailsClose?.();
    });
    this.render();
  }

  returnToTown() {
    if (this.leaving) return;
    this.leaving = true;
    playUiSound(this, 'navigation');
    this.scene.start(this.returnScene);
  }

  // Build the visible workspace from the current selection, page and game state.
  render() {
    renderFacilityMenu(this, this.facility, this.selection,
      selection => {
        this.selection = selection;
        this.selectedItemId = null;
        this.detailOffset = 0;
        this.category = 'all';
        this.itemOffset = 0;
        this.message = '';
        this.selectedScroll = null;
        this.render();
      },
      () => this.returnToTown(),
      choice => this.renderFacilityDetail(choice));
  }

  // Run the requested shop action through the shared rules, then refresh resources and
  // feedback.
  transact(action) {
    HapticsService.tap();
    const result = action();
    const completedSound = ['buy', 'sell', 'inscribe'].includes(this.selection) ? 'purchase' : 'success';
    playUiSound(this, result.ok ? completedSound : 'failure');
    this.message = result.message;

    if (result.ok) {
      saveProfile();
      HapticsService.confirm();
      this.transactionGlow = true;
    }
    this.render();
  }

  // Build the item rows for this facility's selected action and category.
  rowsFor(choice) {
    const state = GameState;
    learnInventoryRecipes(state);
    if (choice.id === 'sell') return saleRows(state, this.facility.name).map(row => ({
      ...row, action: `SELL: ${row.value}g`, run: () => sellOwnedItem(row.id, state, this.facility.name),
      allAction: `SELL ALL: ${row.allValue}g`, runAll: () => sellAllOwnedItem(row.id, state, this.facility.name)
    }));
    if (choice.id === 'craft' || choice.id === 'brew') return CRAFTING_RECIPES.filter(recipe =>
      recipe.crafter === this.facility.name && state.inventory.knownRecipes.includes(recipe.id)
      && (choice.id === 'brew' ? recipe.category === 'alchemy' : ['equipment', 'material'].includes(recipe.category))).map(recipe => ({
      id: recipe.id,
      category: recipe.output.type === 'potion' ? 'potion' : recipe.output.type === 'material' ? 'material'
        : recipe.output.type === 'scroll' ? 'scroll' : getEquipmentDefinition(recipe.output.itemId)?.slot,
      name: recipe.name,
      description: `Crafted with: ${recipeIngredientText(recipe).replaceAll('  •  ', ' + ')}\n${recipe.fee ?? 0} Gold fee`,
      enabled: canCraft(recipe.id).ok, action: choice.id === 'brew' ? 'BREW' : 'CRAFT', run: () => craftItem(recipe.id)
    }));

    if (choice.id === 'buy' && this.facility.name !== 'Enchanter') return (this.facility.name === 'Blacksmith' ? GEAR_STOCK : POTION_ITEMS).map(item => ({
      id: item.id, category: item.slot, name: item.name, description: `${item.description}${item.uses ? ' | 3 uses' : ''}`,
      enabled: state.gold >= item.price, action: `BUY ${item.price}g`, run: () => item.slot === 'potion' ? buyPotionPack(item.id) : buyGear(item.id)
    }));

    if (choice.id === 'buy' || choice.id === 'inscribe') return ACTIVE_ENCHANTMENTS.filter(definition => choice.id === 'buy'
      || CRAFTING_RECIPES.some(recipe => recipe.output.type === 'scroll' && recipe.output.itemId === definition.id
        && state.inventory.knownRecipes.includes(recipe.id))).map(definition => ({
      id: definition.id, category: 'scroll', name: definition.name,
      description: `${enchantmentText(definition)}\n${choice.id === 'inscribe' ? `Crafted with: ${recipeIngredientText(definition).replaceAll('  •  ', ' + ')}\n${definition.craftingFee ?? 0} Gold fee` : 'Consume at Enchant to improve gear.'}`,
      enabled: choice.id === 'buy' ? state.gold >= definition.price
        : state.inventory.knownRecipes?.includes(CRAFTING_RECIPES.find(recipe => recipe.output.itemId === definition.id)?.id)
          && state.gold >= definition.craftingFee
          && Object.entries(definition.ingredients).every(([id, count]) => (state.inventory.materials[id] ?? 0) >= count),
      action: choice.id === 'buy' ? `BUY ${definition.price}g` : 'INSCRIBE',

      // Run the chosen action after the surrounding interaction accepts it.
      run: () => inscribeEnchantment(definition.id, state, choice.id === 'buy')
    }));

    if (choice.id === 'disenchant') return state.inventory.equipment.filter(item => item.slot !== 'scroll' && ENCHANTMENT_BY_ID[item.enchantmentId]).map(item => ({
      id: item.id, category: item.slot, name: item.name, description: `${ENCHANTMENT_BY_ID[item.enchantmentId].name} | Keep gear; recover 2 random recipe materials.`, enabled: true, action: 'DISENCHANT', run: () => disenchantItem(item.id)
    }));

    if (choice.id === 'enchant') {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const scroll = state.inventory.equipment.find(item => item.id === this.selectedScroll && item.slot === 'scroll');
      if (!scroll) return state.inventory.equipment.filter(item => item.slot === 'scroll').map(item => ({
        id: item.id, category: 'scroll', name: item.name, description: enchantmentText(ENCHANTMENT_BY_ID[item.enchantmentId]), enabled: true, action: 'SELECT',

        // Run the chosen action after the surrounding interaction accepts it.
        run: () => {
          this.selectedScroll = item.id;
          this.category = 'all';
          this.itemOffset = 0;
          return { ok: false, message: 'Choose gear to enchant. The selected scroll will be consumed.' };
        }
      }));

      const definition = ENCHANTMENT_BY_ID[scroll.enchantmentId];

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry. filter keeps entries whose
      // callback returns true. It builds a new list and leaves the original list in place.
      return state.inventory.equipment.filter(item => !item.enchantmentId && definition.slots.includes(item.slot)).map(item => {
        const owner = equipmentOwner(item.id, state);

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        const ownership = owner ? `Equipped by ${owner.name}` : 'Unequipped';
        return {
          id: item.id, category: item.slot, name: item.name,
          description: `${ownership}\n${enchantmentText(definition)}`,
          detailsDescription: `${ownership}\n\n${enchantmentText(definition)}. Uses ${scroll.name}.`,
          enabled: true, action: 'ENCHANT',

          // Run the chosen action after the surrounding interaction accepts it.
          run: () => {
            const result = applyEnchantment(scroll.id, item.id);
            if (result.ok) this.selectedScroll = null;
            return result;
          }
        };
      });
    }

    return [];
  }

  // The catalog reads rows from the existing service rules and owns presentation only.
  renderFacilityDetail(choice) {
    renderShopCatalog(this, choice);
  }
}
