export type Generator<T> = { next: () => T };

export type Position = {
  row: number;
  col: number;
};

export enum CHECK_DIRECTION {
  LEFT = `Left`,
  RIGHT = `Right`,
  TOP = `Top`,
  DOWN = `Down`,
}

export type Match<T> = {
  matched: T;
  positions: Position[];
};

export type Piece<T> = {
  value: T;
  position: Position;
};

export type Board<T> = {
  width: number;
  height: number;
  pieces: Piece<T>[];
};

export type Effect<T> = {
  kind: string;
  board?: Board<T>;
  match?: Match<T>;
};

export type MatchResult<T> = {
  effects: Effect<T>[];
  matches: Piece<T>[];
};

export type MoveResult<T> = {
  board: Board<T>;
  effects: Effect<T>[];
};

export function create<T>(
  generator: Generator<T>,
  width: number,
  height: number
): Board<T> {
  return {
    width,
    height,
    pieces: initBoardFill(generator, height, width),
  };
}

export function piece<T>(board: Board<T>, p: Position): T | undefined {
  if (!isPositionOutsideBoard(board, p)) {
    return undefined;
  }
  return findPieceOnPosition(board, p).value;
}

export function canMove<T>(
  board: Board<T>,
  first: Position,
  second: Position
): boolean {
  return isMoveLegal(board, first, second);
}

export function move<T>(
  generator: Generator<T>,
  board: Board<T>,
  first: Position,
  second: Position
): MoveResult<T> {
  if (isMoveLegal(board, first, second)) {
    swapPieces(board, first, second);
    const effects = [];
    scanBoard(board, generator, effects);

    return {
      board,
      effects,
    };
  }

  return {
    board,
    effects: [],
  };
}

function getAllColumnMatches<T>(board: Board<T>): MatchResult<T> {
  let matches: Piece<T>[] = [];
  let effects: Effect<T>[] = [];
  for (let i = board.width; i >= 0; i--) {
    const checkedValues: T[] = [];
    const elementsInColumn = getAllPiecesInColumn(board, i);
    for (const element of elementsInColumn) {
      if (!checkedValues.includes(element.value)) {
        checkedValues.push(element.value);
        const result = columnDeepNeighbourCheck(board, element);
        matches = matches.concat(result.matches);
        effects = effects.concat(result.effects);
      }
    }
  }
  return {
    matches,
    effects,
  };
}

function columnDeepNeighbourCheck<T>(
  board: Board<T>,
  startPiece: Piece<T>
): MatchResult<T> {
  const nextTopPosition = findNextPiecePosition(
    startPiece,
    CHECK_DIRECTION.TOP
  );
  const pieceOnNextTopPosition = findPieceOnPosition(board, nextTopPosition);
  const topElements = neighourCheck(
    board,
    pieceOnNextTopPosition,
    [],
    startPiece.value,
    CHECK_DIRECTION.TOP
  );
  const downElements = neighourCheck(
    board,
    findPieceOnPosition(
      board,
      findNextPiecePosition(startPiece, CHECK_DIRECTION.DOWN)
    ),
    [],
    startPiece.value,
    CHECK_DIRECTION.DOWN
  );

  if (topElements.length + downElements.length + 1 >= 3) {
    const matchedPieces = [...topElements, startPiece, ...downElements];
    return generateMatchEffect(matchedPieces);
  }

  return {
    effects: [],
    matches: [],
  };
}

function refillBoard<T>(
  board: Board<T>,
  generator: Generator<T>,
  effects: Effect<T>[]
) {
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const foundElement = findPieceOnPosition(board, { row, col });
      if (foundElement.value === undefined) {
        shiftElementsInColumn(
          board,
          foundElement.position.row,
          foundElement.position.col
        );
        findPieceOnPosition(board, {
          row: 0,
          col: foundElement.position.col,
        }).value = generator.next();
      }
    }
  }
  effects.push({
    kind: `Refill`,
    board,
  });

  scanBoard(board, generator, effects);
}

function shiftElementsInColumn<T>(
  board: Board<T>,
  fromRow: number,
  col: number
): void {
  for (let row = fromRow; row > 0; row--) {
    swapPieces(board, { row, col }, { row: row - 1, col });
  }
}

function findNextPiecePosition<T>(
  currentPiece: Piece<T>,
  direction: CHECK_DIRECTION
) {
  let position: Position = {
    row: currentPiece.position.row,
    col: currentPiece.position.col,
  };
  if (direction === CHECK_DIRECTION.DOWN) {
    position.row += 1;
  }

  if (direction === CHECK_DIRECTION.TOP) {
    position.row -= 1;
  }

  if (direction === CHECK_DIRECTION.LEFT) {
    position.col -= 1;
  }

  if (direction === CHECK_DIRECTION.RIGHT) {
    position.col += 1;
  }
  return position;
}

function getAllRowMatches<T>(board: Board<T>): MatchResult<T> {
  let matches: Piece<T>[] = [];
  let effects: Effect<T>[] = [];
  for (let i = 0; i < board.height; i++) {
    const checkedValues: T[] = [];
    const elementsInRow = getAllPiecesInRow(board, i);
    for (const element of elementsInRow) {
      if (!checkedValues.includes(element.value)) {
        checkedValues.push(element.value);
        const result = rowDeepNeighbourCheck(board, element);
        matches = matches.concat(result.matches);
        effects = effects.concat(result.effects);
      }
    }
  }
  return {
    matches,
    effects,
  };
}

function rowDeepNeighbourCheck<T>(
  board: Board<T>,
  startPiece: Piece<T>
): MatchResult<T> {
  const leftSideElements = neighourCheck(
    board,
    findPieceOnPosition(
      board,
      findNextPiecePosition(startPiece, CHECK_DIRECTION.LEFT)
    ),
    [],
    startPiece.value,
    CHECK_DIRECTION.LEFT
  );
  const rightSideElements = neighourCheck(
    board,
    findPieceOnPosition(
      board,
      findNextPiecePosition(startPiece, CHECK_DIRECTION.RIGHT)
    ),
    [],
    startPiece.value,
    CHECK_DIRECTION.RIGHT
  );

  if (leftSideElements.length + rightSideElements.length + 1 >= 3) {
    const matchedPieces = [
      ...leftSideElements,
      startPiece,
      ...rightSideElements,
    ];
    return generateMatchEffect(matchedPieces);
  }

  return {
    effects: [],
    matches: [],
  };
}

function neighourCheck<T>(
  board: Board<T>,
  currentPiece: Piece<T>,
  matchingPieces: Piece<T>[],
  value: T,
  checkDirection: CHECK_DIRECTION
) {
  if (!currentPiece) {
    return matchingPieces;
  }
  if (currentPiece.value === value) {
    matchingPieces.push(currentPiece);
    const nextPiece = findPieceOnPosition(
      board,
      findNextPiecePosition(currentPiece, checkDirection)
    );
    neighourCheck(board, nextPiece, matchingPieces, value, checkDirection);
  }
  return matchingPieces;
}

function getAllPiecesInRow<T>(board: Board<T>, rowIndex: number) {
  return board.pieces.filter((element) => {
    return element.position.row === rowIndex;
  });
}

function getAllPiecesInColumn<T>(board: Board<T>, columnIndex: number) {
  return board.pieces.filter((element) => {
    return element.position.col === columnIndex;
  });
}

function scanBoard<T>(
  board: Board<T>,
  generator: Generator<T>,
  effects: Effect<T>[]
): void {
  const rowMatchResults = getAllRowMatches(board);
  const columnMatchResults = getAllColumnMatches(board);
  effects.push(...rowMatchResults.effects);
  effects.push(...columnMatchResults.effects);
  if (rowMatchResults.matches.length || columnMatchResults.matches.length) {
    removedMatchedValues(rowMatchResults.matches, columnMatchResults.matches);
    refillBoard(board, generator, effects);
  }
}

function generateMatchEffect<T>(matchedPieces: Piece<T>[]) {
  return {
    effects: [
      {
        kind: `Match`,
        match: {
          matched: { ...matchedPieces[0] }.value,
          positions: matchedPieces.map((match) => match.position),
        },
      },
    ],
    matches: matchedPieces,
  };
}

function removedMatchedValues<T>(
  matchesRows: Piece<T>[],
  matchesColumn: Piece<T>[]
): void {
  matchesRows.forEach((match) => {
    match.value = undefined;
  });
  matchesColumn.forEach((match) => {
    match.value = undefined;
  });
}

function isMoveLegal<T>(
  board: Board<T>,
  firstPosition: Position,
  secondPosition: Position
): boolean {
  if (
    !isPositionOutsideBoard(board, firstPosition) ||
    !isPositionOutsideBoard(board, secondPosition)
  ) {
    return false;
  }
  if (
    firstPosition.col === secondPosition.col &&
    firstPosition.row === secondPosition.row
  ) {
    return false;
  }

  if (
    firstPosition.col !== secondPosition.col &&
    firstPosition.row !== secondPosition.row
  ) {
    return false;
  }

  swapPieces(board, firstPosition, secondPosition);
  const matchesInRows = getAllRowMatches(board);
  const matchesInColumns = getAllColumnMatches(board);
  swapPieces(board, firstPosition, secondPosition);

  if (!matchesInRows.matches.length && !matchesInColumns.matches.length) {
    return false;
  }
  return true;
}

function isPositionOutsideBoard<T>(board: Board<T>, p: Position): boolean {
  if (p.col >= board.width || p.col < 0) {
    return false;
  }

  if (p.row >= board.height || p.row < 0) {
    return false;
  }
  return true;
}

function swapPieces<T>(board: Board<T>, first: Position, second: Position) {
  const firstPiece = findPieceOnPosition(board, first);
  const secondPiece = findPieceOnPosition(board, second);

  const firstIndex = board.pieces.indexOf(firstPiece);
  const secondIndex = board.pieces.indexOf(secondPiece);

  (board.pieces as any).swapProperties(firstIndex, secondIndex, `value`);
}

function findPieceOnPosition<T>(board: Board<T>, position: Position) {
  return board.pieces.find((element) => {
    return (
      element.position.col == position.col &&
      element.position.row == position.row
    );
  });
}

function initBoardFill<T>(
  generator: Generator<T>,
  height: number,
  width: number
): Piece<T>[] {
  const pieces: Piece<T>[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      pieces.push({
        value: generator.next(),
        position: {
          row,
          col,
        },
      });
    }
  }

  /* Monkey patched function to pieces object. Used when you want to add functionality */
  /*to something already existing, but not fulfilling your needs*/
  (pieces as any).swapProperties = (
    firstIndex: number,
    secondIndex: number,
    propertyToSwap: string
  ) => {
    const firstPieceValue = pieces[firstIndex][propertyToSwap];
    const secondPieceValue = pieces[secondIndex][propertyToSwap];
    pieces[firstIndex][propertyToSwap] = secondPieceValue;
    pieces[secondIndex][propertyToSwap] = firstPieceValue;
  };

  return pieces;
}
