import { useState, useEffect, useRef } from "react";

export function Pupil({
  size = 12,
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY
}) {
  const [mouseX, setMouseX] = useState(null);
  const [mouseY, setMouseY] = useState(null);
  const pupilRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!pupilRef.current || mouseX === null || mouseY === null) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;

    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
}

export function EyeBall({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY
}) {
  const [mouseX, setMouseX] = useState(null);
  const [mouseY, setMouseY] = useState(null);
  const eyeRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!eyeRef.current || mouseX === null || mouseY === null) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;

    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
}

export function AnimatedCharacters({
  isTyping = false,
  showPassword = false,
  passwordLength = 0,
  isSurprised = false,
}) {
  const [mouseX, setMouseX] = useState(null);
  const [mouseY, setMouseY] = useState(null);
  const [isPink1Blinking, setIsPink1Blinking] = useState(false);
  const [isPink2Blinking, setIsPink2Blinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPink1Peeking, setIsPink1Peeking] = useState(false);
  const pink1Ref = useRef(null);
  const pink2Ref = useRef(null);
  const yellowRef = useRef(null);
  const orangeRef = useRef(null);
  const isPasswordVisible = passwordLength > 0 && showPassword && !isSurprised;
  const isHidingPassword = passwordLength > 0 && !showPassword && !isSurprised;

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Blinking effect for pink1 character
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;

    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsPink1Blinking(true);
        setTimeout(() => {
          setIsPink1Blinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());

      return blinkTimeout;
    };

    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  // Blinking effect for pink2 character
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;

    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsPink2Blinking(true);
        setTimeout(() => {
          setIsPink2Blinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());

      return blinkTimeout;
    };

    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  // Looking at each other animation when typing starts
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const timer = setTimeout(() => {
        setIsLookingAtEachOther(false);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setIsLookingAtEachOther(false);
    }
  }, [isTyping]);

  // Pink1 sneaky peeking animation when typing password and it's visible
  useEffect(() => {
    if (isPasswordVisible) {
      const schedulePeek = () => {
        const peekInterval = setTimeout(() => {
          setIsPink1Peeking(true);
          setTimeout(() => {
            setIsPink1Peeking(false);
          }, 800);
        }, Math.random() * 3000 + 2000);
        return peekInterval;
      };

      const firstPeek = schedulePeek();
      return () => clearTimeout(firstPeek);
    } else {
      setIsPink1Peeking(false);
    }
  }, [isPasswordVisible]);

  const calculatePosition = (ref) => {
    if (!ref.current || mouseX === null || mouseY === null) return { faceX: 0, faceY: 0, bodySkew: 0 };

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;

    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    const faceX = Math.max(-15, Math.min(15, deltaX / 20));
    const faceY = Math.max(-10, Math.min(10, deltaY / 30));
    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));

    return { faceX, faceY, bodySkew };
  };

  const pink1Pos = calculatePosition(pink1Ref);
  const pink2Pos = calculatePosition(pink2Ref);
  const yellowPos = calculatePosition(yellowRef);
  const orangePos = calculatePosition(orangeRef);

  return (
    <div
      className="relative"
      style={{
        width: '550px',
        height: '400px',
      }}
    >
      {/* Pink1 tall rectangle character - Back layer */}
      <div
        ref={pink1Ref}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '70px',
          width: '180px',
          height: (isTyping || isHidingPassword) ? '440px' : '400px',
          backgroundColor: '#F8BBD0',
          borderRadius: '10px 10px 0 0',
          zIndex: 1,
          transform: isPasswordVisible
            ? `skewX(0deg)`
            : (isTyping || isHidingPassword)
              ? `skewX(${(pink1Pos.bodySkew || 0) - 12}deg) translateX(40px)`
              : `skewX(${pink1Pos.bodySkew || 0}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Eyes */}
        <div
          className="absolute flex gap-8 transition-all duration-700 ease-in-out"
          style={{
            left: isPasswordVisible ? `${20}px` : isLookingAtEachOther ? `${55}px` : `${45 + pink1Pos.faceX}px`,
            top: isPasswordVisible ? `${35}px` : isLookingAtEachOther ? `${65}px` : `${40 + pink1Pos.faceY}px`,
          }}
        >
          <EyeBall
            size={isSurprised ? 22 : 18}
            pupilSize={isSurprised ? 8 : 7}
            maxDistance={5}
            eyeColor="white"
            pupilColor="#2D2D2D"
            isBlinking={isPink1Blinking}
            forceLookX={isSurprised ? 0 : isPasswordVisible ? (isPink1Peeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
            forceLookY={isSurprised ? 0 : isPasswordVisible ? (isPink1Peeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
          />
          <EyeBall
            size={isSurprised ? 22 : 18}
            pupilSize={isSurprised ? 8 : 7}
            maxDistance={5}
            eyeColor="white"
            pupilColor="#2D2D2D"
            isBlinking={isPink1Blinking}
            forceLookX={isSurprised ? 0 : isPasswordVisible ? (isPink1Peeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
            forceLookY={isSurprised ? 0 : isPasswordVisible ? (isPink1Peeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
          />
        </div>
      </div>

      {/* Pink2 tall rectangle character - Middle layer */}
      <div
        ref={pink2Ref}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '240px',
          width: '120px',
          height: '310px',
          backgroundColor: '#F48FB1',
          borderRadius: '8px 8px 0 0',
          zIndex: 2,
          transform: isPasswordVisible
            ? `skewX(0deg)`
            : isLookingAtEachOther
              ? `skewX(${(pink2Pos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
              : (isTyping || isHidingPassword)
                ? `skewX(${(pink2Pos.bodySkew || 0) * 1.5}deg)`
                : `skewX(${pink2Pos.bodySkew || 0}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Eyes */}
        <div
          className="absolute flex gap-6 transition-all duration-700 ease-in-out"
          style={{
            left: isPasswordVisible ? `${10}px` : isLookingAtEachOther ? `${32}px` : `${26 + pink2Pos.faceX}px`,
            top: isPasswordVisible ? `${28}px` : isLookingAtEachOther ? `${12}px` : `${32 + pink2Pos.faceY}px`,
          }}
        >
          <EyeBall
            size={isSurprised ? 20 : 16}
            pupilSize={isSurprised ? 7 : 6}
            maxDistance={4}
            eyeColor="white"
            pupilColor="#2D2D2D"
            isBlinking={isPink2Blinking}
            forceLookX={isSurprised ? 0 : isPasswordVisible ? -4 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={isSurprised ? 0 : isPasswordVisible ? -4 : isLookingAtEachOther ? -4 : undefined}
          />
          <EyeBall
            size={isSurprised ? 20 : 16}
            pupilSize={isSurprised ? 7 : 6}
            maxDistance={4}
            eyeColor="white"
            pupilColor="#2D2D2D"
            isBlinking={isPink2Blinking}
            forceLookX={isSurprised ? 0 : isPasswordVisible ? -4 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={isSurprised ? 0 : isPasswordVisible ? -4 : isLookingAtEachOther ? -4 : undefined}
          />
        </div>
      </div>

      {/* Orange semi-circle character - Front left */}
      <div
        ref={orangeRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '0px',
          width: '240px',
          height: '200px',
          zIndex: 3,
          backgroundColor: '#FF9B6B',
          borderRadius: '120px 120px 0 0',
          transform: isPasswordVisible ? `skewX(0deg)` : `skewX(${orangePos.bodySkew || 0}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Eyes - just pupils, no white */}
        <div
          className="absolute flex gap-8 transition-all duration-200 ease-out"
          style={{
            left: isPasswordVisible ? `${50}px` : `${82 + (orangePos.faceX || 0)}px`,
            top: isPasswordVisible ? `${85}px` : `${90 + (orangePos.faceY || 0)}px`,
          }}
        >
          <Pupil size={isSurprised ? 15 : 12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={isSurprised ? 0 : isPasswordVisible ? -5 : undefined} forceLookY={isSurprised ? 0 : isPasswordVisible ? -4 : undefined} />
          <Pupil size={isSurprised ? 15 : 12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={isSurprised ? 0 : isPasswordVisible ? -5 : undefined} forceLookY={isSurprised ? 0 : isPasswordVisible ? -4 : undefined} />
        </div>
      </div>

      {/* Yellow tall rectangle character - Front right */}
      <div
        ref={yellowRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '310px',
          width: '140px',
          height: '230px',
          backgroundColor: '#E8D754',
          borderRadius: '70px 70px 0 0',
          zIndex: 4,
          transform: isPasswordVisible ? `skewX(0deg)` : `skewX(${yellowPos.bodySkew || 0}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Eyes - just pupils, no white */}
        <div
          className="absolute flex gap-6 transition-all duration-200 ease-out"
          style={{
            left: isPasswordVisible ? `${20}px` : `${52 + (yellowPos.faceX || 0)}px`,
            top: isPasswordVisible ? `${35}px` : `${40 + (yellowPos.faceY || 0)}px`,
          }}
        >
          <Pupil size={isSurprised ? 15 : 12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={isSurprised ? 0 : isPasswordVisible ? -5 : undefined} forceLookY={isSurprised ? 0 : isPasswordVisible ? -4 : undefined} />
          <Pupil size={isSurprised ? 15 : 12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={isSurprised ? 0 : isPasswordVisible ? -5 : undefined} forceLookY={isSurprised ? 0 : isPasswordVisible ? -4 : undefined} />
        </div>
        {/* Horizontal line for mouth */}
        <div
          className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
          style={{
            left: isSurprised ? `${58 + (yellowPos.faceX || 0)}px` : isPasswordVisible ? `${10}px` : `${40 + (yellowPos.faceX || 0)}px`,
            top: isSurprised ? `${78 + (yellowPos.faceY || 0)}px` : isPasswordVisible ? `${88}px` : `${88 + (yellowPos.faceY || 0)}px`,
            width: isSurprised ? '28px' : undefined,
            height: isSurprised ? '28px' : undefined,
            backgroundColor: isSurprised ? 'transparent' : undefined,
            border: isSurprised ? '4px solid #2D2D2D' : undefined,
            borderRadius: isSurprised ? '9999px' : undefined,
          }}
        />
      </div>
    </div>
  );
}
