GOAL : Create Hand Tracking and Face Expression Interactive experience for Snowy Window

INTERACTIVE POINT :

1. Hand Tracking , bounding box can wipe the snowy window
2. Each Finger top point landmarks can wipe the snowy window
3. Mouse Open will make snowy again in window

EXPLAINATION :

1. Snowy windows means the condensation snowy on the window
2. Window means current XR sdk camera input <SCENE>

EXPECTED :

- Using the Screen Image with (position 0,0 | scale2d 1,1 | rotation 0, size 720,1280) this act like snowy condensation screen
- Using the webgl shaders material , that material will assign to condensation screen image
- snowy condensation webgl shaders will have true condensation animation like condensation start at random one point and slows filling the whole screen
- Hand Tracking Boudning box will act like mouse cursor or wipping, user show hand to wipe the webgl condensation shaders in the ranges
- Finger tips hand landmarks will also act like mouse cursor or wipping, user show hand to wipe the webgl condensation shaders in its finger tips area ranges
<!-- - Mouse Open will act like filling the webgl condensation shaders in the areas of moues open , like some snow or wind are coming out from the mouth and fiil the wipped area with shaders -->
- After all should write in creator zone accorind to check zone mjs.

CODE PRACTICE :

- All code must write in modularization with OBJECT-ORIENTED PROGRAMMING
- All code practice must passed the all tests file and smoke check
- All assets and material and tracking should download with lazy loading
- Experience only show , the camera start opening the XR scene started , must start after all lazy loading async finished to pass throttling
- Add config as one place , creator high level config , so that i can play the dynamic experience , hard coded shouldn't do if possible
