/* Supplied runtime derivatives only. All identities and strip metadata come from the verified pack. */
(function(root){'use strict';const data=root.LoreTreasureArtData,slot=id=>Object.freeze({...data[id],id});
const map=ids=>Object.freeze(Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,slot(id)])));
root.LoreTreasureAssets=Object.freeze({
 backgrounds:map({grand:'backgrounds/grand_hall',expedition:'backgrounds/expedition_gallery',guardian:'backgrounds/guardian_reliquary',mastery:'backgrounds/mastery_chamber'}),
 emblems:map({grand:'emblems/treasure_hall_main_crest',expedition:'emblems/expedition_wing',guardian:'emblems/guardian_wing',mastery:'emblems/mastery_chamber','destination-complete':'monuments/destination_monument','guardian-memorial':'monuments/guardian_memorial'}),
 badges:Object.freeze(['bronze','silver','gold','sapphire','purple','crystal'].map((n,i)=>slot('mastery_ranks/rank_0'+(i+1)+'_'+n))),
 frames:map({undiscovered:'frames/undiscovered',collection:'frames/discovered',mastered:'frames/mastered'}),
 categories:map({companions:'categories/companion_mastery',recruits:'categories/recruit_mastery',pets:'categories/pet_mastery',achievements:'categories/achievement_mastery'}),
 furniture:map({plinth:'furniture/empty_stone_plinth',case:'furniture/glass_display_case',stand:'furniture/ornate_artifact_stand',book:'furniture/ancient_book_display',memorial:'furniture/guardian_memorial_pedestal',map:'furniture/expedition_map_table'}),
 monuments:map({guardian:'monuments/guardian_memorial',destination:'monuments/destination_monument',collection:'monuments/collection_completion_crest'}),
 effects:map({flame:'effects/flame_flicker',particles:'effects/magic_particles',glow:'effects/relic_glow',burst:'effects/mastery_burst'}),
 fallback:'assets/town-woodland.webp'
});
})(globalThis);
