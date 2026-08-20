import React, { useState, useEffect } from "react";

const HumanVerification = ({ 
  isOpen, 
  onVerified, 
  onClose, 
  title = "🤖 Human Verification",
  message = "Please verify you're human before continuing"
}) => {
  const [currentChallenge, setCurrentChallenge] = useState("slider");
  const [isVerified, setIsVerified] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [mathAnswer, setMathAnswer] = useState("");
  const [mathProblem, setMathProblem] = useState({});
  const [patternClicks, setPatternClicks] = useState([]);
  const [requiredPattern, setRequiredPattern] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [, setIsDragging] = useState(false);

  // Generate math problem
  useEffect(() => {
    const generateMath = () => {
      const a = Math.floor(Math.random() * 15) + 5;
      const b = Math.floor(Math.random() * 10) + 1;
      const operations = ['+', '-'];
      const op = operations[Math.floor(Math.random() * operations.length)];
      const answer = op === '+' ? a + b : a - b;
      
      setMathProblem({ a, b, op, answer });
    };

    const generatePattern = () => {
      const pattern = [];
      for (let i = 0; i < 3; i++) {
        pattern.push(Math.floor(Math.random() * 9));
      }
      setRequiredPattern(pattern);
    };

    if (isOpen) {
      generateMath();
      generatePattern();
      setIsVerified(false);
      setSliderValue(0);
      setMathAnswer("");
      setPatternClicks([]);
      setAttempts(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Fixed slider verification
  const handleSliderChange = (e) => {
    const newValue = parseInt(e.target.value);
    setSliderValue(newValue);
    
    if (newValue >= 95 && !isLoading) {
      setIsLoading(true);
      setTimeout(() => {
        setIsVerified(true);
        setIsLoading(false);
        setTimeout(() => {
          onVerified();
        }, 1000);
      }, 1500);
    }
  };

  // Math verification
  const handleMathSubmit = () => {
    if (parseInt(mathAnswer) === mathProblem.answer) {
      setIsLoading(true);
      setTimeout(() => {
        setIsVerified(true);
        setIsLoading(false);
        setTimeout(() => {
          onVerified();
        }, 1000);
      }, 1000);
    } else {
      setAttempts(prev => prev + 1);
      setMathAnswer("");
      if (attempts >= 2) {
        setCurrentChallenge("pattern");
      }
    }
  };

  // Pattern verification
  const handlePatternClick = (index) => {
    if (patternClicks.length < requiredPattern.length) {
      const newClicks = [...patternClicks, index];
      setPatternClicks(newClicks);
      
      if (newClicks.length === requiredPattern.length) {
        const isCorrect = newClicks.every((click, i) => click === requiredPattern[i]);
        if (isCorrect) {
          setIsLoading(true);
          setTimeout(() => {
            setIsVerified(true);
            setIsLoading(false);
            setTimeout(() => {
              onVerified();
            }, 1000);
          }, 1000);
        } else {
          setTimeout(() => {
            setPatternClicks([]);
            setAttempts(prev => prev + 1);
          }, 500);
        }
      }
    }
  };

  const switchChallenge = () => {
    const challenges = ["slider", "math", "pattern"];
    const currentIndex = challenges.indexOf(currentChallenge);
    const nextIndex = (currentIndex + 1) % challenges.length;
    setCurrentChallenge(challenges[nextIndex]);
    setAttempts(0);
    setSliderValue(0); // Reset slider when switching
  };

  if (!isOpen) return null;

  return (
    <div className="verification-overlay">
      <div className="verification-modal">
        <div className="verification-header">
          <h3>{title}</h3>
          <p className="verification-subtitle">{message}</p>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="verification-content">
          {isVerified ? (
            <div className="verification-success">
              <div className="success-icon">✅</div>
              <h4>Verification Complete!</h4>
              <p>Redirecting you now...</p>
            </div>
          ) : (
            <>
              {/* Fixed Slider Challenge */}
              {currentChallenge === "slider" && (
                <div className="challenge-container">
                  <h4>🧩 Slide to Complete</h4>
                  <p>Drag the slider all the way to the right</p>
                  
                  <div className="slider-container">
                    <div className="slider-track">
                      <div 
                        className="slider-progress" 
                        style={{ width: `${sliderValue}%` }}
                      ></div>
                      <div 
                        className="slider-thumb" 
                        style={{ left: `calc(${sliderValue}% - 25px)` }}
                      >
                        {isLoading ? "⏳" : sliderValue >= 95 ? "✅" : "🔒"}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderValue}
                      onChange={handleSliderChange}
                      onMouseDown={() => setIsDragging(true)}
                      onMouseUp={() => setIsDragging(false)}
                      onTouchStart={() => setIsDragging(true)}
                      onTouchEnd={() => setIsDragging(false)}
                      className="slider-input"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="slider-instruction">
                    {sliderValue < 95 ? "Slide to unlock →" : isLoading ? "Verifying..." : "Release to verify!"}
                  </div>
                </div>
              )}

              {/* Math Challenge */}
              {currentChallenge === "math" && (
                <div className="challenge-container">
                  <h4>🧮 Solve This Problem</h4>
                  <p>Answer the math question below</p>
                  
                  <div className="math-problem">
                    <span className="math-text">
                      {mathProblem.a} {mathProblem.op} {mathProblem.b} = ?
                    </span>
                  </div>
                  
                  <div className="math-input-group">
                    <input
                      type="number"
                      value={mathAnswer}
                      onChange={(e) => setMathAnswer(e.target.value)}
                      placeholder="Your answer"
                      className="math-input"
                      onKeyPress={(e) => e.key === 'Enter' && handleMathSubmit()}
                    />
                    <button 
                      className="btn btn-verify" 
                      onClick={handleMathSubmit}
                      disabled={!mathAnswer || isLoading}
                    >
                      {isLoading ? "⏳ Checking..." : "Verify"}
                    </button>
                  </div>
                  
                  {attempts > 0 && (
                    <p className="error-message">
                      Incorrect answer. Try again! ({attempts}/3 attempts)
                    </p>
                  )}
                </div>
              )}

              {/* Pattern Challenge */}
              {currentChallenge === "pattern" && (
                <div className="challenge-container">
                  <h4>🎯 Click the Pattern</h4>
                  <p>Click the squares in this order: {requiredPattern.map(n => n + 1).join(" → ")}</p>
                  
                  <div className="pattern-grid">
                    {[...Array(9)].map((_, index) => (
                      <button
                        key={index}
                        className={`pattern-cell ${patternClicks.includes(index) ? 'clicked' : ''}`}
                        onClick={() => handlePatternClick(index)}
                        disabled={isLoading}
                      >
                        {patternClicks.includes(index) ? '✓' : index + 1}
                      </button>
                    ))}
                  </div>
                  
                  <div className="pattern-progress">
                    Progress: {patternClicks.length}/{requiredPattern.length}
                  </div>
                </div>
              )}

              <div className="verification-footer">
                <button className="btn btn-secondary" onClick={switchChallenge}>
                  🔄 Try Different Challenge
                </button>
                <div className="security-badge">
                  <span className="shield-icon">🛡️</span>
                  Secured by NFTicket Verification
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HumanVerification;
