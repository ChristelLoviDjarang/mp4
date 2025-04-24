// Viseme mapping for lip sync
export const VISEME_MAP = {
    // Original mappings
    A: "viseme_PP",
    B: "viseme_kk",
    C: "viseme_I",
    D: "viseme_AA",
    E: "viseme_O",
    F: "viseme_U",
    G: "viseme_FF",
    H: "viseme_TH",
    X: "viseme_PP",
    
    // Additional mappings that might exist in the model
    // Standard visemes
    sil: "viseme_sil",
    PP: "viseme_PP",
    FF: "viseme_FF",
    TH: "viseme_TH",
    DD: "viseme_DD",
    kk: "viseme_kk",
    CH: "viseme_CH",
    SS: "viseme_SS",
    nn: "viseme_nn",
    RR: "viseme_RR",
    aa: "viseme_aa",
    E: "viseme_E",
    I: "viseme_I",
    O: "viseme_O",
    U: "viseme_U",
    
    // Try standard blendshape names too
    jawOpen: "jawOpen",
    mouthOpen: "mouthOpen",
    mouthWide: "mouthWide",
    mouthClose: "mouthClose",
    mouthSmile: "mouthSmile"
};

// Predefined facial expressions
export const FACIAL_EXPRESSIONS = {
    default: {},
    bigSmile: {
        browInnerUp: 0.5,         
        eyeSquintLeft: 0.5,       
        eyeSquintRight: 0.5,
        mouthSmileLeft: 0.7,     
        mouthSmileRight: 0.7,
        noseSneerLeft: 0.5,   
        noseSneerRight: 0.5,          
        cheekPuff: 0.2          
    },
    smallSmile: {
        browInnerUp: 0.3,        
        eyeSquintLeft: 0.4,       
        eyeSquintRight: 0.4,
        mouthSmileLeft: 0.6,      
        mouthSmileRight: 0.6,
        noseSneerLeft: 0.2,       
        noseSneerRight: 0.2,
        cheekPuff: 0.2            
    }
};
