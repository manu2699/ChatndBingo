import React from "react";

export const BingoMatrix = ({
	boxIdPrefix,
	onDrag,
	onDrop,
	onAllowDrop,
	onCut
}) => {
	return (
		<div id='Bingo'>
			<table
				cellPadding='10px'
				cellSpacing='8px'
				style={{ textAlign: "center" }}>
				<tbody>
					<tr>
						<th id='B'>B</th>
						<th id='I'>I</th>
						<th id='N'>N</th>
						<th id='G'>G</th>
						<th id='O'>O</th>
					</tr>
					<tr>
						<td
							id={`${boxIdPrefix}1`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							1
						</td>
						<td
							id={`${boxIdPrefix}2`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							2
						</td>
						<td
							id={`${boxIdPrefix}3`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							3
						</td>
						<td
							id={`${boxIdPrefix}4`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							4
						</td>
						<td
							id={`${boxIdPrefix}5`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							5
						</td>
					</tr>
					<tr>
						<td
							id={`${boxIdPrefix}6`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							6
						</td>
						<td
							id={`${boxIdPrefix}7`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							7
						</td>
						<td
							id={`${boxIdPrefix}8`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							8
						</td>
						<td
							id={`${boxIdPrefix}9`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							9
						</td>
						<td
							id={`${boxIdPrefix}10`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							10
						</td>
					</tr>
					<tr>
						<td
							id={`${boxIdPrefix}11`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							11
						</td>
						<td
							id={`${boxIdPrefix}12`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							12
						</td>
						<td
							id={`${boxIdPrefix}13`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							13
						</td>
						<td
							id={`${boxIdPrefix}14`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							14
						</td>
						<td
							id={`${boxIdPrefix}15`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							15
						</td>
					</tr>
					<tr>
						<td
							id={`${boxIdPrefix}16`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							16
						</td>
						<td
							id={`${boxIdPrefix}17`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							17
						</td>
						<td
							id={`${boxIdPrefix}18`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							18
						</td>
						<td
							id={`${boxIdPrefix}19`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							19
						</td>
						<td
							id={`${boxIdPrefix}20`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							20
						</td>
					</tr>
					<tr>
						<td
							id={`${boxIdPrefix}21`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							21
						</td>
						<td
							id={`${boxIdPrefix}22`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							22
						</td>
						<td
							id={`${boxIdPrefix}23`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							23
						</td>
						<td
							id={`${boxIdPrefix}24`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							24
						</td>
						<td
							id={`${boxIdPrefix}25`}
							draggable='true'
							onDragStart={(event) => {
								onDrag(event);
							}}
							onDrop={(event) => {
								onDrop(event);
							}}
							onDragOver={(event) => {
								onAllowDrop(event);
							}}
							className='untouched'
							onClick={(event) => {
								onCut(event);
							}}>
							25
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
};
