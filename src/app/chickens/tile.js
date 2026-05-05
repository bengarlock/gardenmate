'use client'


const Tile = (props) => {



    return (
        <div className="group m-2 w-48 h-48 overflow-hidden  shadow-lg transform transition-transform duration-300 hover:scale-105">
            <img src="https://via.placeholder.com/150" alt="Placeholder Image" className="w-full h-full object-cover" />
        </div>
    )

}

export default Tile